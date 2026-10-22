// reports.cpp — port of backend/routers/reports.py
//
// Citizen-facing report endpoints. Guest reporting is sacred: no auth, OTP, GPS or
// photo is ever required to submit (preserved requirement). Risk signals inform human
// review — they never block, reject or delay a report.
//
// ---------------------------------------------------------------------------
// Expected from the other ports (same names as the Python modules):
//
//   ../lib/db.hpp        extern Database db;  Motor-style collections with MongoDB filter syntax:
//                          std::optional<json> find_one(const json& filter);
//                          std::vector<json>   find(const json& filter = json::object(),
//                                                   const std::string& sort_key = "", int sort_dir = 1,
//                                                   int limit = 0);       // find().sort().to_list(limit)
//                          long long count_documents(const json& filter);
//                          void insert_one(const json& doc);
//                          void update_one(const json& filter, const json& update, bool upsert = false);
//                                                                         // supports $set and $push
//                          void delete_one(const json& filter);
//   ../lib/audit.hpp     void add_audit(const std::string& action, const std::string& target,
//                                       const std::string& actor, const std::string& role,
//                                       const std::optional<std::string>& reason = std::nullopt,
//                                       const std::optional<std::string>& prev = std::nullopt,
//                                       const std::optional<std::string>& nxt = std::nullopt);
//   ../lib/catalog.hpp   extern const std::map<std::string, std::vector<std::string>> CAT;  // CAT[c][0] = label
//                        extern const std::vector<std::string> TEST_WORDS;
//                        std::string classify_severity(text, category, urgency);
//   ../lib/routing.hpp   extern const std::string CENTER_NODE;  std::string snap(double x, double y);
//   ../lib/security.hpp  TimePoint utcnow();  struct Principal { user_id, type, name, role, ident; };
//                        std::optional<Principal> get_principal(const crow::request&);
//   ../models/ease.hpp   Loc { bool manual; optional<string> address; optional<double> lat, lng,
//                              accuracy_m, map_x, map_y; }
//                        RiskSignal(id, kind, weight, text)        Risk(score, level, signals)
//                        HistoryEntry(stage, note, actor)          Reply(by, role, text)
//                        Report { code, category, label, urgency, severity, text, node, loc, details,
//                                 reporter_name, phone, acct, risk, needs_review, hist, replies,
//                                 status, unit, ..., created_at, updated_at }
//                        ReportCreate { category, text, urgency, loc, details, reporter_name, phone }
//                        ReportCancel { phone, reason }     ReplyCreate { phone, text }
//                        ReportPublic { code, category, label, severity, status, unit, created_at,
//                                       hist, replies, loc_note, text, node, full }
//                        Every struct also has a default constructor and nlohmann to_json / from_json;
//                        Report's defaults match the Pydantic ones (status "Reported", created_at and
//                        updated_at = utcnow(), ...). Optional fields are written as null.
// ---------------------------------------------------------------------------

#include "reports.hpp"

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cmath>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "../lib/audit.hpp"
#include "../lib/catalog.hpp"
#include "../lib/db.hpp"
#include "../lib/routing.hpp"
#include "../lib/security.hpp"
#include "../models/ease.hpp"
#include "pyshim.hpp"

// router = APIRouter(prefix="/reports", tags=["reports"])  -> "/api/reports" is written into each route below

static const std::vector<std::string> ACTIVE_STATUSES = {
    "Reported", "Acknowledged", "Under review", "Assigned", "En route", "On scene"};

std::optional<std::string> norm_phone(const std::optional<std::string>& p) {
    if (!p || p->empty()) return std::nullopt;
    std::string digits;                                     // re.sub(r"\D", "", p)
    for (unsigned char c : *p)
        if (std::isdigit(c)) digits.push_back(static_cast<char>(c));
    if (digits.size() >= 10) return digits.substr(digits.size() - 10);
    if (!digits.empty()) return digits;
    return std::nullopt;
}

Report to_report(const json& doc) {
    // The Python version turned naive datetimes into UTC ones here. TimePoint is always UTC,
    // so the document converts straight into a Report.
    return doc.get<Report>();
}

std::string loc_note(const Loc& loc) {
    if (loc.manual && loc.address && !loc.address->empty())
        return "Location: " + *loc.address;
    if (loc.lat)
        return "GPS location shared (\xC2\xB1" +
               std::to_string(static_cast<long long>(std::nearbyint(loc.accuracy_m.value_or(0.0)))) + " m)";
    return "Location not shared";
}

// Signals only. Anonymity itself is NEVER a signal; a flagged report is never
// auto-rejected — it stays fully visible in the queue for human review.
Risk compute_risk(const std::string& text, const std::string& category,
                  const std::optional<std::string>& phone, const std::optional<std::string>& acct) {
    std::vector<RiskSignal> signals;
    int score = 0;
    std::string t = to_lower(text);
    for (const auto& w : TEST_WORDS) {
        if (t.find(w) != std::string::npos) {
            score += 30;
            signals.push_back(RiskSignal("testwords", "inferred", 30, "Wording suggests a test or joke."));
            break;
        }
    }
    const bool acct_is_user = acct && !acct->empty() && *acct != "guest";
    std::optional<std::string> ident_phone = (acct && *acct == "guest") ? phone : std::nullopt;
    const bool ident_phone_set = ident_phone && !ident_phone->empty();
    if (acct_is_user || ident_phone_set) {
        auto since = utcnow() - std::chrono::seconds(120);
        json q = {{"created_at", {{"$gte", since}}}, {"$or", json::array()}};
        if (ident_phone_set) q["$or"].push_back(json{{"phone", *ident_phone}});
        if (acct_is_user) q["$or"].push_back(json{{"acct", *acct}});
        long long recent = db.reports.count_documents(q);
        if (recent >= 2) {
            score += 30;
            signals.push_back(RiskSignal("burst", "observed", 30, "Several submission attempts within 2 minutes."));
        }
    }
    json dup_q = {{"category", category}, {"created_at", {{"$gte", utcnow() - std::chrono::minutes(15)}}}};
    std::vector<json> others = db.reports.find(dup_q, "", 1, 50);
    std::set<std::string> words;
    for (const auto& w : split_ws(t)) words.insert(w);
    for (const auto& o : others) {
        std::set<std::string> ow;
        for (const auto& w : split_ws(to_lower(str_at(o, "text")))) ow.insert(w);
        if (ow.empty()) continue;
        std::size_t common = 0;                              // len(words & ow)
        for (const auto& w : words)
            if (ow.count(w)) ++common;
        double overlap = static_cast<double>(common) /
                         static_cast<double>(std::max<std::size_t>(1, std::min(words.size(), ow.size())));
        if (words.size() >= 4 && overlap >= 0.6) {
            score += 25;
            signals.push_back(RiskSignal("duplicate", "observed", 25,
                                         "Similar report received recently (" + str_at(o, "code") +
                                             ") \xE2\x80\x94 possible duplicate."));
            break;
        }
    }
    std::string level = score >= 60 ? "high" : (score >= 25 ? "medium" : "low");
    return Risk(score, level, signals);
}

// @router.post("", response_model=Report, status_code=201)
Report create_report(const ReportCreate& body, const std::optional<Principal>& principal) {
    std::string category = CAT.count(body.category) ? body.category : std::string("other");
    std::string text = strip(body.text);
    if (py_len(text) < 5)
        throw HTTPException{422, "Describe the situation in a few words."};
    const bool is_citizen = principal && principal->type == "citizen";
    std::string acct = is_citizen ? principal->user_id : std::string("guest");
    std::optional<std::string> reporter;
    if (is_citizen) {
        reporter = principal->name;
    } else {
        std::string name = strip(body.reporter_name.value_or(""));      // (body.reporter_name or "").strip() or None
        if (!name.empty()) reporter = name;
    }
    std::optional<std::string> phone = is_citizen ? std::optional<std::string>(principal->ident)
                                                  : norm_phone(body.phone);
    std::string severity = classify_severity(text, category, body.urgency);
    std::string node = (body.loc.map_x && body.loc.map_y) ? snap(*body.loc.map_x, *body.loc.map_y)
                                                          : CENTER_NODE;
    Risk risk = compute_risk(text, category, phone, acct);
    std::string code = "RPT-" + to_upper(secrets::token_hex(3));
    Report rep;
    rep.code = code;
    rep.category = category;
    rep.label = CAT.at(category).at(0);
    rep.urgency = body.urgency;
    rep.severity = severity;
    rep.text = text;
    rep.node = node;
    rep.loc = body.loc;
    rep.details = body.details;
    rep.reporter_name = reporter;
    rep.phone = phone;
    rep.acct = acct;
    rep.risk = risk;
    rep.needs_review = risk.level != "low";
    rep.hist = {HistoryEntry("Reported", loc_note(body.loc), reporter.value_or("Guest"))};
    db.reports.insert_one(json(rep));                        // rep.model_dump()
    add_audit("Report received", code, reporter.value_or("Guest"),
              acct != "guest" ? "Citizen" : "Guest",
              CAT.at(category).at(0) + " \xC2\xB7 " + severity);
    return rep;
}

// @router.get("/mine", response_model=list[Report])
std::vector<Report> my_reports(const std::optional<Principal>& principal) {
    if (!principal || principal->type != "citizen") return {};
    json filter = {{"$or", json::array({json{{"acct", principal->user_id}}, json{{"phone", principal->ident}}})}};
    std::vector<json> docs = db.reports.find(filter, "created_at", -1, 200);
    std::vector<Report> out;
    for (const auto& d : docs) out.push_back(to_report(d));
    return out;
}

// @router.get("/{code}", response_model=ReportPublic)
ReportPublic get_report(const std::string& code, const std::optional<std::string>& phone,
                        const std::optional<Principal>& principal) {
    std::optional<json> doc = db.reports.find_one({{"code", code}});
    if (!doc)
        throw HTTPException{404, "No report with that reference. Check the code and try again."};
    bool full = false;
    std::optional<std::string> doc_phone = get_opt_str(*doc, "phone");
    if (principal && principal->type == "staff") {
        full = true;
    } else if (principal && principal->type == "citizen" && get_opt_str(*doc, "acct") == principal->user_id) {
        full = true;
    } else if (phone && !phone->empty() && doc_phone && !doc_phone->empty() && norm_phone(phone) == doc_phone) {
        full = true;
    }
    Report rep = to_report(*doc);
    ReportPublic out;
    out.code = rep.code;
    out.category = rep.category;
    out.label = rep.label;
    out.severity = rep.severity;
    out.status = rep.status;
    out.unit = rep.unit;
    out.created_at = rep.created_at;
    out.hist = rep.hist;
    out.replies = rep.replies;
    out.loc_note = loc_note(rep.loc);
    out.node = rep.node;
    if (full) {
        out.text = rep.text;
        out.full = true;
        return out;
    }
    // Anonymous follow-up by reference code: status timeline only — no reporter PII, no risk data.
    out.full = false;
    return out;
}

namespace {

json _own_report(const std::string& code, const std::optional<std::string>& body_phone,
                 const std::optional<Principal>& principal) {
    std::optional<json> doc = db.reports.find_one({{"code", code}});
    if (!doc)
        throw HTTPException{404, "No report with that reference."};
    std::optional<std::string> doc_acct = get_opt_str(*doc, "acct");
    std::optional<std::string> doc_phone = get_opt_str(*doc, "phone");
    bool owned = (principal && principal->type == "citizen" && doc_acct == principal->user_id) ||
                 (doc_acct == std::string("guest") && doc_phone && !doc_phone->empty() &&
                  body_phone && !body_phone->empty() && norm_phone(body_phone) == doc_phone);
    if (!owned)
        throw HTTPException{403, "Only the person who filed this report can change it."};
    return *doc;
}

}  // namespace

// @router.post("/{code}/cancel", response_model=Report)
Report cancel_report(const std::string& code, const ReportCancel& body, const std::optional<Principal>& principal) {
    json doc = _own_report(code, body.phone, principal);
    std::string status = str_at(doc, "status");
    if (status != "Reported" && status != "Acknowledged")
        throw HTTPException{409, "This report has already been actioned \xE2\x80\x94 call 112 if circumstances changed."};
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"status", "Cancelled"}, {"updated_at", utcnow()}}},
        {"$push", {{"hist", json(HistoryEntry("Cancelled", py_or(body.reason, "Cancelled by reporter"), "Reporter"))}}},
    });
    add_audit("Report cancelled by reporter", code, "Reporter", "Citizen", body.reason);
    return to_report(db.reports.find_one({{"code", code}}).value());
}

// @router.post("/{code}/reply", response_model=Report)
Report citizen_reply(const std::string& code, const ReplyCreate& body, const std::optional<Principal>& principal) {
    json doc = _own_report(code, body.phone, principal);
    std::string by;                                          // principal.name if citizen else doc.get("reporter_name") or "Guest"
    if (principal && principal->type == "citizen") {
        by = principal->name;
    } else {
        std::optional<std::string> reporter_name = get_opt_str(doc, "reporter_name");
        by = py_or(reporter_name, "Guest");
    }
    db.reports.update_one({{"code", code}}, {
        {"$set", {{"updated_at", utcnow()}}},
        {"$push", {{"replies", json(Reply(by, "citizen", strip(body.text)))}}},
    });
    return to_report(db.reports.find_one({{"code", code}}).value());
}

// ---------------------------------------------------------------------------
// Route wiring (what the @router.* decorators did in FastAPI).
// Same order as the Python file: "/mine" is registered before "/<code>".
// ---------------------------------------------------------------------------
void register_reports_routes(crow::SimpleApp& app) {
    CROW_ROUTE(app, "/api/reports").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            std::optional<Principal> principal = get_principal(req);
            ReportCreate body = parse_body<ReportCreate>(req);
            return json_ok(create_report(body, principal), 201);
        });
    });

    CROW_ROUTE(app, "/api/reports/mine").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            std::optional<Principal> principal = get_principal(req);
            return json_ok(my_reports(principal));
        });
    });

    CROW_ROUTE(app, "/api/reports/<string>").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            std::optional<Principal> principal = get_principal(req);
            std::optional<std::string> phone;
            if (const char* v = req.url_params.get("phone")) phone = std::string(v);
            return json_ok(get_report(code, phone, principal));
        });
    });

    CROW_ROUTE(app, "/api/reports/<string>/cancel").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            std::optional<Principal> principal = get_principal(req);
            ReportCancel body = parse_body<ReportCancel>(req);
            return json_ok(cancel_report(code, body, principal));
        });
    });

    CROW_ROUTE(app, "/api/reports/<string>/reply").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req, const std::string& code) {
        return handle([&]() {
            std::optional<Principal> principal = get_principal(req);
            ReplyCreate body = parse_body<ReplyCreate>(req);
            return json_ok(citizen_reply(code, body, principal));
        });
    });
}
