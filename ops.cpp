// ops.cpp — port of backend/routers/ops.py
//
// Command Centre operations API. Read = any staff role; every mutating action is
// permission-gated (deny-by-default) and written to the audit trail with reason and
// before/after values. 403 = role can't act; 404 = unknown record.
//
// ---------------------------------------------------------------------------
// Expected from the other ports (same names as the Python modules):
//
//   ../lib/db.hpp        extern Database db;  db.reports / db.units / db.users / db.audit, each with
//                        Motor-style calls that take MongoDB filter / update syntax:
//                          std::optional<json> find_one(const json& filter);
//                          std::vector<json>   find(const json& filter = json::object(),
//                                                   const std::string& sort_key = "", int sort_dir = 1,
//                                                   int limit = 0);       // find().sort().to_list(limit)
//                          long long count_documents(const json& filter);
//                          void update_one(const json& filter, const json& update, bool upsert = false);
//                                                                         // supports $set and $push
//                        $regex / $options, $or, $ne and dotted keys such as "loc.address" must work.
//   ../lib/audit.hpp     void add_audit(action, target, actor, role, reason, prev, nxt)
//                          (reason / prev / nxt are std::optional<std::string>, default std::nullopt)
//   ../lib/catalog.hpp   CAT   : std::map<std::string, std::vector<std::string>>   (CAT[c][0] = label)
//                        NEXT  : std::map<std::string, std::vector<std::string>>
//                        SEV_RANK : std::map<std::string, int>
//                        SVC   : std::map<std::string, std::string>
//                        UNIT_STATUSES : std::vector<std::string>
//   ../lib/routing.hpp   route(src, dst) -> std::tuple<double km, path, pts, int settled, double ms>
//                        int eta_min(double km);
//   ../lib/security.hpp  TimePoint utcnow();
//                        struct Principal { name, role, ...; bool can(const std::string& perm) const; };
//                        Principal require_staff(const crow::request&);                       // 401 / 403
//                        Principal require_perm(const crow::request&, const std::string& perm); // deny-by-default
//                        (Python's Depends(require_perm("ack")) becomes require_perm(req, "ack"))
//   ../models/ease.hpp   Request bodies : ReasonBody { optional<string> reason },
//                          StatusChange { status, reason }, PriorityChange { severity, reason },
//                          AssignBody { unit_id, reason }, NoteBody { text },
//                          ReviewDecision { decision, optional note }, FlagBody { bool flag, reason },
//                          LinkBody { other_code, reason }, UnitStatusPatch { stat, reason },
//                          UnitActivePatch { bool active, reason }, RoleChange { role, reason },
//                          DisableChange { bool disabled, reason }
//                        Records : Report, Unit, AuditEntry, Analytics { total, active, resolved,
//                          by_status, by_severity, by_category (std::map<string,int>),
//                          optional<double> avg_ack_min, units_available, units_total },
//                          UserAdminView { id, type, name, role, ident, disabled, created_at }
//                          (fields in this order)
//                        Constructors mirroring the Pydantic keyword arguments:
//                          HistoryEntry(stage, note, actor), Reply(by, role, text),
//                          RiskSignal(id, kind, weight, text)
//                        Every struct also has a default constructor and nlohmann to_json / from_json.
// ---------------------------------------------------------------------------

#include "ops.hpp"

#include <algorithm>
#include <chrono>
#include <limits>
#include <map>
#include <numeric>
#include <optional>
#include <string>
#include <vector>

#include "../lib/audit.hpp"
#include "../lib/catalog.hpp"
#include "../lib/db.hpp"
#include "../lib/routing.hpp"
#include "../lib/security.hpp"
#include "../models/ease.hpp"
#include "pyshim.hpp"

// router = APIRouter(prefix="/ops", tags=["ops"])  -> "/api/ops" is written into each route below

namespace {

Report to_report(const json& doc) {
    // The Python version turned naive datetimes into UTC ones here. TimePoint is always UTC,
    // so the document converts straight into a Report.
    return doc.get<Report>();
}

bool is_active(const std::string& status) {
    return status != "Resolved" && status != "Closed" && status != "Cancelled";
}

json load_incident(const std::string& code) {
    std::optional<json> doc = db.reports.find_one({{"code", code}});
    if (!doc)
        throw HTTPException{404, "No incident with that reference."};
    return *doc;
}

void aud(const Principal& p, const std::string& action, const std::string& target,
         const std::optional<std::string>& reason = std::nullopt,
         const std::optional<std::string>& prev = std::nullopt,
         const std::optional<std::string>& nxt = std::nullopt) {
    add_audit(action, target, p.name, p.role, reason, prev, nxt);
}

// {"$regex": re.escape(s), "$options": "i"}
json regex_i(const std::string& s) {
    return json{{"$regex", re_escape(s)}, {"$options", "i"}};
}

// ------------------------------------------------------------------ queue / detail

json queue(const std::string& status, const std::string& severity, const std::string& category,
           const std::string& q, const std::string& sort, const Principal& /*p*/) {
    json query = json::object();
    if (!status.empty()) query["status"] = status;
    if (!severity.empty()) query["severity"] = severity;
    if (!category.empty()) query["category"] = category;
    if (!q.empty()) {
        json or_list = json::array();
        or_list.push_back(json{{"code", regex_i(q)}});
        or_list.push_back(json{{"text", regex_i(q)}});
        or_list.push_back(json{{"loc.address", regex_i(q)}});
        query["$or"] = or_list;
    }
    std::vector<json> docs = db.reports.find(query, "created_at", -1, 1000);
    std::vector<Report> items;
    for (const auto& d : docs) items.push_back(to_report(d));
    if (sort == "pri") {
        // key=(SEV_RANK.get(severity, 0), created_at.timestamp()), reverse=True (stable)
        auto key = [](const Report& r) {
            auto it = SEV_RANK.find(r.severity);
            int rank = it == SEV_RANK.end() ? 0 : it->second;
            double ts = std::chrono::duration<double>(r.created_at.time_since_epoch()).count();
            return std::make_pair(rank, ts);
        };
        std::stable_sort(items.begin(), items.end(),
                         [&](const Report& a, const Report& b) { return key(a) > key(b); });
    }
    return json{{"items", items}, {"total", items.size()}};
}

Report incident(const std::string& code, const Principal& /*p*/) {
    return to_report(load_incident(code));
}

// ------------------------------------------------------------------ lifecycle

Report ack(const std::string& code, const std::optional<ReasonBody>& body, const Principal& p) {
    json doc = load_incident(code);
    if (str_at(doc, "status") != "Reported")
        throw HTTPException{409, "Cannot acknowledge from " + str_at(doc, "status") + "."};
    std::optional<std::string> reason = body ? body->reason : std::nullopt;
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"status", "Acknowledged"}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Acknowledged", py_or(reason, "Operator acknowledged"), p.name))}}},
    });
    aud(p, "Acknowledged", code, reason, "Reported", "Acknowledged");
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report change_status(const std::string& code, const StatusChange& body, const Principal& p) {
    json doc = load_incident(code);
    std::vector<std::string> allowed;                       // NEXT.get(doc["status"], [])
    auto next_it = NEXT.find(str_at(doc, "status"));
    if (next_it != NEXT.end()) allowed = next_it->second;
    if (std::find(allowed.begin(), allowed.end(), body.status) == allowed.end())
        throw HTTPException{409, "Cannot move " + str_at(doc, "status") + " \xE2\x86\x92 " + body.status + "."};
    json updates = {{"status", body.status}, {"updated_at", utcnow()}};
    std::optional<std::string> doc_unit = get_opt_str(doc, "unit");
    if ((body.status == "En route" || body.status == "On scene") && doc_unit && !doc_unit->empty())
        db.units.update_one({{"id", *doc_unit}}, {{"$set", {{"stat", body.status}}}});
    db.reports.update_one({{"code", code}}, {
        {"$set", updates},
        {"$push", {{"hist", json(HistoryEntry(body.status, py_or(body.reason, "Status updated by " + p.name), p.name))}}},
    });
    aud(p, "Status \xE2\x86\x92 " + body.status, code, body.reason, str_at(doc, "status"), body.status);
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report change_priority(const std::string& code, const PriorityChange& body, const Principal& p) {
    json doc = load_incident(code);
    if (body.severity == str_at(doc, "severity"))
        throw HTTPException{409, "Priority is already set to that value."};
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"severity", body.severity}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Priority change",
                                              str_at(doc, "severity") + " \xE2\x86\x92 " + body.severity, p.name))}}},
    });
    aud(p, "Priority change", code, body.reason, str_at(doc, "severity"), body.severity);
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report assign(const std::string& code, const AssignBody& body, const Principal& p) {
    json doc = load_incident(code);
    if (!is_active(str_at(doc, "status")))
        throw HTTPException{409, "This incident is closed."};
    std::optional<json> unit = db.units.find_one({{"id", body.unit_id}});
    if (!unit)
        throw HTTPException{404, "No such response unit."};
    std::string category = str_at(doc, "category");
    auto svc_it = SVC.find(category);
    std::string need = svc_it != SVC.end() ? svc_it->second : std::string();   // SVC.get(doc["category"])
    if (!need.empty() && str_at(*unit, "svc") != need) {
        auto cat_it = CAT.find(category);
        std::string cat_label = cat_it != CAT.end() ? cat_it->second.at(0) : std::string("this incident");
        throw HTTPException{400, str_at(*unit, "id") + " is a " + str_at(*unit, "svc") + " unit; a " + cat_label +
                                     " incident needs a " + need + " unit."};
    }
    if (!get_bool(*unit, "active", true))
        throw HTTPException{400, str_at(*unit, "id") + " is deactivated."};
    double km = std::get<0>(route(str_at(*unit, "node"), str_at(doc, "node")));
    if (km == std::numeric_limits<double>::infinity())
        throw HTTPException{409, "No road path from that unit's base on the sample graph."};
    std::string prev_status = str_at(doc, "status");
    std::optional<std::string> prev_unit = get_opt_str(doc, "unit");
    const bool had_prev_unit = prev_unit && !prev_unit->empty();
    std::string new_status = (prev_status == "Reported" || prev_status == "Acknowledged" ||
                              prev_status == "Under review") ? std::string("Assigned") : prev_status;
    std::string unit_stat = (new_status == "Assigned" || new_status == "En route" || new_status == "On scene")
                                ? new_status : std::string("Assigned");
    if (had_prev_unit && *prev_unit != str_at(*unit, "id"))
        db.units.update_one({{"id", *prev_unit}}, {{"$set", {{"stat", "Available"}}}});
    db.units.update_one({{"id", str_at(*unit, "id")}}, {{"$set", {{"stat", unit_stat}}}});
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"unit", str_at(*unit, "id")}, {"status", new_status},
                  {"route_km", py_round(km, 2)}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry(
            !had_prev_unit ? "Unit assigned" : "Unit reassigned",
            str_at(*unit, "id") + " (" + str_at(*unit, "facility") + ") \xC2\xB7 shortest-path " + fmt_fixed(km, 1) +
                " km \xC2\xB7 est. " + std::to_string(eta_min(km)) + " min (sample graph)",
            p.name))}}},
    });
    aud(p, !had_prev_unit ? "Unit assigned" : "Unit reassigned", code, body.reason,
        (had_prev_unit ? *prev_unit : std::string("\xE2\x80\x94")) + " / " + prev_status,
        str_at(*unit, "id") + " / " + new_status);
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report resolve(const std::string& code, const ReasonBody& body, const Principal& p) {
    json doc = load_incident(code);
    if (!is_active(str_at(doc, "status")))
        throw HTTPException{409, "This incident is already closed."};
    std::optional<std::string> doc_unit = get_opt_str(doc, "unit");
    if (doc_unit && !doc_unit->empty())
        db.units.update_one({{"id", *doc_unit}}, {{"$set", {{"stat", "Available"}}}});
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"status", "Resolved"}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Resolved", py_or(body.reason, "Resolved by " + p.name), p.name))}}},
    });
    aud(p, "Resolved", code, body.reason, str_at(doc, "status"), "Resolved");
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report close(const std::string& code, const ReasonBody& body, const Principal& p) {
    json doc = load_incident(code);
    if (str_at(doc, "status") != "Resolved")
        throw HTTPException{409, "Resolve the incident before closing it."};
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"status", "Closed"}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Closed", py_or(body.reason, "Closed by " + p.name), p.name))}}},
    });
    aud(p, "Closed", code, body.reason, "Resolved", "Closed");
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report reopen(const std::string& code, const ReasonBody& body, const Principal& p) {
    json doc = load_incident(code);
    if (str_at(doc, "status") != "Resolved" && str_at(doc, "status") != "Closed")
        throw HTTPException{409, "Only resolved or closed incidents can be reopened."};
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"status", "Under review"}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Reopened", py_or(body.reason, "Reopened by " + p.name), p.name))}}},
    });
    aud(p, "Reopened", code, body.reason, str_at(doc, "status"), "Under review");
    return to_report(db.reports.find_one({{"code", code}}).value());
}

// ------------------------------------------------------------------ notes / replies / risk

Report add_note(const std::string& code, const NoteBody& body, const Principal& p) {
    load_incident(code);                                    // 404 if the incident does not exist
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Internal note", strip(body.text), p.name))}}},
    });
    aud(p, "Internal note", code, py_prefix(strip(body.text), 120));
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report staff_reply(const std::string& code, const NoteBody& body, const Principal& p) {
    load_incident(code);                                    // 404 if the incident does not exist
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"updated_at", utcnow()}}},
        {"$push", {{"replies", json(Reply(p.name, "staff", strip(body.text)))}}},
    });
    aud(p, "Reply sent to reporter", code, py_prefix(strip(body.text), 120));
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report review(const std::string& code, const ReviewDecision& body, const Principal& p) {
    if (body.decision == "escalated" && !p.can("rview2"))
        throw HTTPException{403, "Escalation requires a supervisor."};
    json doc = load_incident(code);
    bool needs = body.decision != "cleared";
    static const std::map<std::string, std::string> default_notes = {
        {"cleared", "Reviewed \xE2\x80\x94 no further action"},
        {"needs-review", "Needs further review"},
        {"escalated", "Escalated for supervisor review"}};
    std::string note = (body.note && !body.note->empty()) ? *body.note : default_notes.at(body.decision);
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"needs_review", needs}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Risk review", note, p.name))}}},
    });
    aud(p, "Risk review: " + note, code, body.note,
        "needs_review=" + py_str_get(doc, "needs_review"), "needs_review=" + py_bool(needs));
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report flag(const std::string& code, const FlagBody& body, const Principal& p) {
    json doc = load_incident(code);
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"flag", body.flag},
                  {"flag_reason", (body.flag && body.reason) ? json(*body.reason) : json(nullptr)},
                  {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry(body.flag ? "Flagged" : "Flag removed", body.reason, p.name))}}},
    });
    aud(p, body.flag ? "Flagged for attention" : "Flag removed", code, body.reason,
        "flag=" + py_str_get(doc, "flag"), "flag=" + py_bool(body.flag));
    return to_report(db.reports.find_one({{"code", code}}).value());
}

Report link_dup(const std::string& code, const LinkBody& body, const Principal& p) {
    json doc = load_incident(code);
    std::optional<json> other = db.reports.find_one({{"code", body.other_code}});
    if (!other)
        throw HTTPException{404, "No report with that reference to link."};
    if (body.other_code == code)
        throw HTTPException{400, "An incident cannot link to itself."};
    RiskSignal signal("dup-link", "observed", 25, "Linked as possible duplicate of " + body.other_code + ".");
    int new_score = std::min(100, doc.at("risk").value("score", 0) + 25);
    std::string level = new_score >= 60 ? "high" : (new_score >= 25 ? "medium" : "low");
    json signals = doc.at("risk").value("signals", json::array());
    signals.push_back(json(signal));
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"link", body.other_code}, {"updated_at", utcnow()},
                  {"risk", {{"score", new_score}, {"level", level}, {"signals", signals}}}}},
        {"$push", {{"hist", json(HistoryEntry("Linked", "Possible duplicate of " + body.other_code, p.name))}}},
    });
    aud(p, "Linked possible duplicate", code, body.reason,
        py_or(get_opt_str(doc, "link"), "\xE2\x80\x94"), body.other_code);
    return to_report(db.reports.find_one({{"code", code}}).value());
}

// ------------------------------------------------------------------ units

std::vector<Unit> units(const Principal& /*p*/) {
    std::vector<json> docs = db.units.find(json::object(), "id", 1, 200);
    std::vector<Unit> out;
    for (const auto& d : docs) out.push_back(d.get<Unit>());
    return out;
}

Unit unit_status(const std::string& unit_id, const UnitStatusPatch& body, const Principal& p) {
    std::optional<json> doc = db.units.find_one({{"id", unit_id}});
    if (!doc)
        throw HTTPException{404, "No such unit."};
    if (std::find(UNIT_STATUSES.begin(), UNIT_STATUSES.end(), body.stat) == UNIT_STATUSES.end())
        throw HTTPException{422, "Unknown unit status."};
    db.units.update_one({{"id", unit_id}}, {{"$set", {{"stat", body.stat}}}});
    aud(p, "Unit status \xE2\x86\x92 " + body.stat, unit_id, body.reason, str_at(*doc, "stat"), body.stat);
    return db.units.find_one({{"id", unit_id}}).value().get<Unit>();
}

Unit unit_active(const std::string& unit_id, const UnitActivePatch& body, const Principal& p) {
    std::optional<json> doc = db.units.find_one({{"id", unit_id}});
    if (!doc)
        throw HTTPException{404, "No such unit."};
    db.units.update_one({{"id", unit_id}}, {{"$set", {{"active", body.active}}}});
    aud(p, !body.active ? "Unit deactivated" : "Unit reactivated", unit_id, body.reason,
        "active=" + py_str_get(*doc, "active"), "active=" + py_bool(body.active));
    return db.units.find_one({{"id", unit_id}}).value().get<Unit>();
}

// ------------------------------------------------------------------ audit / analytics / users

std::vector<AuditEntry> audit_list(const std::string& actor, const std::string& action,
                                   const std::string& target, const Principal& /*p*/) {
    json query = json::object();
    if (!actor.empty()) query["actor"] = regex_i(actor);
    if (!action.empty()) query["action"] = regex_i(action);
    if (!target.empty()) query["target"] = regex_i(target);
    std::vector<json> docs = db.audit.find(query, "n", -1, 300);
    std::vector<AuditEntry> out;
    for (const auto& d : docs) out.push_back(d.get<AuditEntry>());   // (no timezone fix-up needed)
    return out;
}

Analytics analytics(const Principal& /*p*/) {
    std::vector<json> docs = db.reports.find(json::object(), "", 1, 5000);
    std::map<std::string, int> by_status, by_sev, by_cat;
    std::vector<double> ack_minutes;
    for (const auto& d : docs) {
        by_status[str_at(d, "status")] += 1;
        by_sev[str_at(d, "severity")] += 1;
        by_cat[str_at(d, "category")] += 1;
        auto hist_it = d.find("hist");
        if (hist_it == d.end() || !hist_it->is_array()) continue;
        for (const auto& h : *hist_it) {
            auto ts_it = h.find("ts");
            auto created_it = d.find("created_at");
            if (get_str(h, "stage") == "Acknowledged" && ts_it != h.end() && !ts_it->is_null() &&
                created_it != d.end() && !created_it->is_null()) {
                double delta = std::chrono::duration<double>(ts_it->get<TimePoint>() -
                                                             created_it->get<TimePoint>()).count();
                if (0 <= delta && delta < 86400) ack_minutes.push_back(delta / 60);
            }
        }
    }
    std::vector<json> units_docs = db.units.find(json::object(), "", 1, 200);
    Analytics result;
    result.total = static_cast<int>(docs.size());
    result.active = static_cast<int>(std::count_if(docs.begin(), docs.end(),
        [](const json& d) { return is_active(str_at(d, "status")); }));
    result.resolved = static_cast<int>(std::count_if(docs.begin(), docs.end(),
        [](const json& d) { return str_at(d, "status") == "Resolved" || str_at(d, "status") == "Closed"; }));
    result.by_status = by_status;
    result.by_severity = by_sev;
    result.by_category = by_cat;
    if (!ack_minutes.empty())
        result.avg_ack_min = py_round(std::accumulate(ack_minutes.begin(), ack_minutes.end(), 0.0) /
                                          static_cast<double>(ack_minutes.size()), 1);
    else
        result.avg_ack_min = std::nullopt;
    result.units_available = static_cast<int>(std::count_if(units_docs.begin(), units_docs.end(),
        [](const json& u) { return get_str(u, "stat") == "Available" && get_bool(u, "active", true); }));
    result.units_total = static_cast<int>(units_docs.size());
    return result;
}

std::vector<UserAdminView> list_users(const Principal& /*p*/) {
    std::vector<json> docs = db.users.find(json::object(), "created_at", 1, 500);
    std::vector<UserAdminView> out;
    for (const auto& d : docs) {
        // (the Python version had a timezone fix-up here that changed nothing)
        out.push_back(UserAdminView{str_at(d, "id"), str_at(d, "type"), str_at(d, "name"),
                                    get_str(d, "role", "Citizen"), str_at(d, "ident"),
                                    get_bool(d, "disabled", false), d.at("created_at").get<TimePoint>()});
    }
    return out;
}

long long _active_admins() {
    return db.users.count_documents({{"type", "staff"}, {"role", "Admin"}, {"disabled", json{{"$ne", true}}}});
}

UserAdminView set_role(const std::string& user_id, const RoleChange& body, const Principal& p) {
    std::optional<json> doc = db.users.find_one({{"id", user_id}});
    if (!doc || str_at(*doc, "type") != "staff")
        throw HTTPException{404, "No such staff account."};
    if (body.role != "Dispatcher" && body.role != "Supervisor" && body.role != "Admin" &&
        body.role != "Read-only analyst")
        throw HTTPException{422, "Unknown role."};
    if (str_at(*doc, "role") == "Admin" && body.role != "Admin" && _active_admins() <= 1)
        throw HTTPException{409, "At least one active administrator is required."};
    db.users.update_one({{"id", user_id}}, {{"$set", {{"role", body.role}}}});
    aud(p, "Role change", str_at(*doc, "ident"), body.reason, str_at(*doc, "role"), body.role);
    json d = db.users.find_one({{"id", user_id}}).value();
    return UserAdminView{str_at(d, "id"), str_at(d, "type"), str_at(d, "name"), str_at(d, "role"),
                         str_at(d, "ident"), get_bool(d, "disabled", false),
                         d.contains("created_at") ? d.at("created_at").get<TimePoint>() : utcnow()};
}

UserAdminView set_disabled(const std::string& user_id, const DisableChange& body, const Principal& p) {
    std::optional<json> doc = db.users.find_one({{"id", user_id}});
    if (!doc || str_at(*doc, "type") != "staff")
        throw HTTPException{404, "No such staff account."};
    if (body.disabled && str_at(*doc, "role") == "Admin" && _active_admins() <= 1)
        throw HTTPException{409, "At least one active administrator is required."};
    db.users.update_one({{"id", user_id}}, {{"$set", {{"disabled", body.disabled}}}});
    aud(p, body.disabled ? "Account disabled" : "Account enabled", str_at(*doc, "ident"), body.reason,
        "disabled=" + py_str_get(*doc, "disabled"), "disabled=" + py_bool(body.disabled));
    json d = db.users.find_one({{"id", user_id}}).value();
    return UserAdminView{str_at(d, "id"), str_at(d, "type"), str_at(d, "name"), str_at(d, "role"),
                         str_at(d, "ident"), get_bool(d, "disabled", false),
                         d.contains("created_at") ? d.at("created_at").get<TimePoint>() : utcnow()};
}

}  // namespace

// ---------------------------------------------------------------------------
// Route wiring (what the @router.* decorators did in FastAPI).
// The Depends(require_staff / require_perm(...)) check runs first in every route, so a
// 401 / 403 is returned before the request body is looked at (same order as FastAPI).
// ---------------------------------------------------------------------------
void register_ops_routes(crow::SimpleApp& app) {
    // ---- queue / detail
    CROW_ROUTE(app, "/api/ops/queue").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            Principal p = require_staff(req);
            return json_ok(queue(query_or(req, "status"), query_or(req, "severity"), query_or(req, "category"),
                                 query_or(req, "q"), query_or(req, "sort", "pri"), p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_staff(req);
            return json_ok(incident(code, p));
        });
    });

    // ---- lifecycle
    CROW_ROUTE(app, "/api/ops/incident/<string>/ack").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "ack");
            std::optional<ReasonBody> body = parse_optional_body<ReasonBody>(req);
            return json_ok(ack(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/status").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "review_st");
            StatusChange body = parse_body<StatusChange>(req);
            return json_ok(change_status(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/priority").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "prio");
            PriorityChange body = parse_body<PriorityChange>(req);
            return json_ok(change_priority(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/assign").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "assign");
            AssignBody body = parse_body<AssignBody>(req);
            return json_ok(assign(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/resolve").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "resolve");
            ReasonBody body = parse_body<ReasonBody>(req);
            return json_ok(resolve(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/close").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "resolve");
            ReasonBody body = parse_body<ReasonBody>(req);
            return json_ok(close(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/reopen").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "reopen");
            ReasonBody body = parse_body<ReasonBody>(req);
            return json_ok(reopen(code, body, p));
        });
    });

    // ---- notes / replies / risk
    CROW_ROUTE(app, "/api/ops/incident/<string>/note").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "note");
            NoteBody body = parse_body<NoteBody>(req);
            return json_ok(add_note(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/reply").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "note");
            NoteBody body = parse_body<NoteBody>(req);
            return json_ok(staff_reply(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/review").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "rview");
            ReviewDecision body = parse_body<ReviewDecision>(req);
            return json_ok(review(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/flag").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "flag");
            FlagBody body = parse_body<FlagBody>(req);
            return json_ok(flag(code, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/incident/<string>/link").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            Principal p = require_perm(req, "link");
            LinkBody body = parse_body<LinkBody>(req);
            return json_ok(link_dup(code, body, p));
        });
    });

    // ---- units
    CROW_ROUTE(app, "/api/ops/units").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            Principal p = require_staff(req);
            return json_ok(units(p));
        });
    });

    CROW_ROUTE(app, "/api/ops/units/<string>/status").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& unit_id) {
        return handle([&]() {
            Principal p = require_perm(req, "unit");
            UnitStatusPatch body = parse_body<UnitStatusPatch>(req);
            return json_ok(unit_status(unit_id, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/units/<string>/active").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& unit_id) {
        return handle([&]() {
            Principal p = require_perm(req, "unit");
            UnitActivePatch body = parse_body<UnitActivePatch>(req);
            return json_ok(unit_active(unit_id, body, p));
        });
    });

    // ---- audit / analytics / users
    CROW_ROUTE(app, "/api/ops/audit").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            Principal p = require_staff(req);
            return json_ok(audit_list(query_or(req, "actor"), query_or(req, "action"), query_or(req, "target"), p));
        });
    });

    CROW_ROUTE(app, "/api/ops/analytics").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            Principal p = require_staff(req);
            return json_ok(analytics(p));
        });
    });

    CROW_ROUTE(app, "/api/ops/users").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            Principal p = require_perm(req, "users");
            return json_ok(list_users(p));
        });
    });

    CROW_ROUTE(app, "/api/ops/users/<string>/role").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& user_id) {
        return handle([&]() {
            Principal p = require_perm(req, "users");
            RoleChange body = parse_body<RoleChange>(req);
            return json_ok(set_role(user_id, body, p));
        });
    });

    CROW_ROUTE(app, "/api/ops/users/<string>/disabled").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& user_id) {
        return handle([&]() {
            Principal p = require_perm(req, "users");
            DisableChange body = parse_body<DisableChange>(req);
            return json_ok(set_disabled(user_id, body, p));
        });
    });
}
