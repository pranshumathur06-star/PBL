#include "OpsRouter.h"
#include "CityGraphData.h"
#include "json.hpp"
#include <bsoncxx/json.hpp>
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <mongocxx/collection.hpp>
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <ctime>
#include <cctype>
#include <functional>
#include <iomanip>
#include <sstream>
#include <limits>
#include <queue>
#include <set>
#include <cstdio>
#include <string>
#include <unordered_map>
#include <vector>
namespace ease::ops {
namespace {
using json = nlohmann::json;
struct Staff {
    std::string id, name, role, ident;
};
std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(),
        [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}
std::string trim(const std::string& value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    return value.substr(first, value.find_last_not_of(" \t\r\n") - first + 1);
}
std::string text(const json& value, const std::string& key,
                 const std::string& fallback = "") {
    return value.contains(key) && value[key].is_string()
        ? value[key].get<std::string>() : fallback;
}
bool boolean(const json& value, const std::string& key, bool fallback = false) {
    return value.contains(key) && value[key].is_boolean()
        ? value[key].get<bool>() : fallback;
}
json readBody(const httplib::Request& request) {
    try { return json::parse(request.body); }
    catch (...) { return json::object(); }
}
void send(httplib::Response& response, const json& data, int status = 200) {
    response.status = status;
    response.set_content(data.dump(), "application/json");
}
void fail(httplib::Response& response, int status, const std::string& message) {
    send(response, {{"detail", message}}, status);
}
json findOne(mongocxx::collection collection, const json& filter) {
    auto bsonFilter = bsoncxx::from_json(filter.dump());
    auto result = collection.find_one(bsonFilter.view());
    if (!result) return nullptr;
    json value = json::parse(bsoncxx::to_json(*result));
    value.erase("_id");
    return value;
}
json findMany(mongocxx::collection collection, const json& filter = json::object()) {
    auto bsonFilter = bsoncxx::from_json(filter.dump());
    json result = json::array();
    for (const auto& item : collection.find(bsonFilter.view())) {
        json value = json::parse(bsoncxx::to_json(item));
        value.erase("_id");
        result.push_back(std::move(value));
    }
    return result;
}
void updateOne(mongocxx::collection collection, const json& filter,
               const json& changes) {
    auto bsonFilter = bsoncxx::from_json(filter.dump());
    auto bsonChanges = bsoncxx::from_json(changes.dump());
    collection.update_one(bsonFilter.view(), bsonChanges.view());
}
long long nowMilliseconds() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}
std::string newId(const std::string& prefix) {
    static std::atomic<unsigned long long> counter{0};
    return prefix + std::to_string(nowMilliseconds()) + "-" +
           std::to_string(counter++);
}
json nowDate() {
    return {{"$date", {{"$numberLong", std::to_string(nowMilliseconds())}}}};
}
long long parseDateValue(const json& value) {
    try {
        if (value.is_number()) return value.get<long long>();
        if (value.is_object() && value.contains("$numberLong"))
            return std::stoll(value["$numberLong"].get<std::string>());
        if (value.is_string()) {
            const std::string date = value.get<std::string>();
            std::tm tm{};
            std::istringstream input(date.substr(0, 19));
            input >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
            if (input.fail()) return 0;
#ifdef _WIN32
            long long ms = static_cast<long long>(_mkgmtime(&tm)) * 1000;
#else
            long long ms = static_cast<long long>(timegm(&tm)) * 1000;
#endif
            const auto dot = date.find('.');
            if (dot != std::string::npos && dot + 1 < date.size()) {
                std::string fraction = date.substr(dot + 1, 3);
                while (fraction.size() < 3) fraction += '0';
                ms += std::stoi(fraction);
            }
            return ms;
        }
    } catch (...) {}
    return 0;
}
long long dateMilliseconds(const json& value) {
    if (value.is_object() && value.contains("$date"))
        return parseDateValue(value["$date"]);
    return parseDateValue(value);
}
json history(const std::string& stage, const std::string& note,
             const std::string& actor) {
    return {{"ts", nowDate()}, {"stage", stage}, {"note", note}, {"actor", actor}};
}
void fixDates(json& value) {
    if (value.is_array()) {
        for (auto& item : value) fixDates(item);
    } else if (value.is_object()) {
        if (value.contains("$date")) {
            const long long ms = dateMilliseconds(value);
            const std::time_t seconds = static_cast<std::time_t>(ms / 1000);
            std::tm tm = *std::gmtime(&seconds);
            char buffer[32];
            std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S", &tm);
            const int milliseconds = static_cast<int>((ms % 1000 + 1000) % 1000);
            char fraction[8];
            std::snprintf(fraction, sizeof(fraction), ".%03dZ", milliseconds);
            value = std::string(buffer) + fraction;
            return;
        }
        for (auto it = value.begin(); it != value.end(); ++it) fixDates(it.value());
    }
}
json clean(json value) {
    value.erase("_id");
    fixDates(value);
    return value;
}
std::string cookieValue(const httplib::Request& request, const std::string& name) {
    const auto header = request.get_header_value("Cookie");
    std::size_t start = 0;
    while (start < header.size()) {
        const auto end = header.find(';', start);
        const std::string part = trim(header.substr(start, end - start));
        const auto equal = part.find('=');
        if (equal != std::string::npos && part.substr(0, equal) == name)
            return part.substr(equal + 1);
        if (end == std::string::npos) break;
        start = end + 1;
    }
    return "";
}
bool hasPermission(const std::string& role, const std::string& permission) {
    static const std::unordered_map<std::string, std::set<std::string>> permissions = {
        {"Dispatcher", {"ack","review_st","prio","note","assign","link","resolve","unit","rview","flag"}},
        {"Supervisor", {"ack","review_st","prio","note","assign","link","resolve","unit","rview","flag","reopen"}},
        {"Admin", {"ack","review_st","prio","note","assign","link","resolve","unit","rview","flag","reopen","users"}},
        {"Read-only analyst", {}}
    };
    auto found = permissions.find(role);
    return found != permissions.end() && found->second.count(permission) != 0;
}
bool getStaff(const httplib::Request& request, httplib::Response& response,
              mongocxx::database& db, Staff& staff,
              const std::string& permission = "") {
    const std::string token = cookieValue(request, "ease_session");
    if (token.empty()) {
        fail(response, 401, "Staff sign-in required.");
        return false;
    }
    json session = findOne(db["sessions"],
        {{"token", token}, {"expires_at", {{"$gt", nowDate()}}}});
    if (session.is_null()) {
        fail(response, 401, "Staff sign-in required.");
        return false;
    }
    json user = findOne(db["users"], {{"id", text(session, "user_id")}});
    if (user.is_null() || text(user, "type") != "staff" || boolean(user, "disabled")) {
        fail(response, 401, "Staff sign-in required.");
        return false;
    }
    staff = {text(user, "id"), text(user, "name", "User"),
             text(user, "role", "Citizen"), text(user, "ident")};
    if (!permission.empty() && !hasPermission(staff.role, permission)) {
        fail(response, 403, "Your role cannot perform this action.");
        return false;
    }
    return true;
}
bool activeStatus(const std::string& status) {
    return status != "Resolved" && status != "Closed" && status != "Cancelled";
}
bool incidentExists(mongocxx::database& db, const std::string& code,
                    httplib::Response& response, json& incident) {
    incident = findOne(db["reports"], {{"code", code}});
    if (incident.is_null()) {
        fail(response, 404, "No incident with that reference.");
        return false;
    }
    return true;
}
void addAudit(mongocxx::database& db, const Staff& staff,
              const std::string& action, const std::string& target,
              const std::string& reason = "", const std::string& previous = "",
              const std::string& next = "") {
    auto audit = db["audit"];
    bsoncxx::builder::basic::document emptyFilter;
    const auto count = audit.count_documents(emptyFilter.view());
    json entry = {
        {"id", newId("AUD-")},
        {"n", static_cast<long long>(count + 1)}, {"ts", nowDate()},
        {"actor", staff.name}, {"role", staff.role}, {"action", action},
        {"target", target}, {"reason", reason.empty() ? json(nullptr) : json(reason)},
        {"prev", previous.empty() ? json(nullptr) : json(previous)},
        {"next", next.empty() ? json(nullptr) : json(next)}, {"sample", false}
    };
    auto document = bsoncxx::from_json(entry.dump());
    audit.insert_one(document.view());
}
void addHistory(mongocxx::database& db, const std::string& code,
                const std::string& stage, const std::string& note,
                const Staff& staff) {
    updateOne(db["reports"], {{"code", code}},
        {{"$set", {{"updated_at", nowDate()}}},
         {"$push", {{"hist", history(stage, note, staff.name)}}}});
}
json getUpdatedReport(mongocxx::database& db, const std::string& code) {
    return clean(findOne(db["reports"], {{"code", code}}));
}
std::string serviceFor(const std::string& category) {
    if (category == "medical" || category == "accident") return "ambulance";
    if (category == "fire" || category == "flood") return "fire";
    if (category == "theft" || category == "violence") return "police";
    if (category == "ev") return "mech";
    return "";
}
int severityRank(const std::string& severity) {
    if (severity == "Critical") return 4;
    if (severity == "High") return 3;
    if (severity == "Medium") return 2;
    return 1;
}
double roadDistance(const std::string& start, const std::string& finish) {
    using Edge = std::pair<std::string, double>;
    std::unordered_map<std::string, std::vector<Edge>> graph;
    for (const auto& edge : ease::routing::kEdges) {
        const double km = edge.pixelLength / ease::routing::kPixelsPerKm;
        graph[edge.from].push_back({edge.to, km});
        graph[edge.to].push_back({edge.from, km});
    }
    using Item = std::pair<double, std::string>;
    std::priority_queue<Item, std::vector<Item>, std::greater<Item>> queue;
    std::unordered_map<std::string, double> distance;
    distance[start] = 0.0;
    queue.push({0.0, start});
    while (!queue.empty()) {
        auto [cost, node] = queue.top(); queue.pop();
        if (node == finish) return cost;
        if (cost > distance[node]) continue;
        for (const auto& [next, weight] : graph[node]) {
            const double candidate = cost + weight;
            if (!distance.count(next) || candidate < distance[next]) {
                distance[next] = candidate;
                queue.push({candidate, next});
            }
        }
    }
    return std::numeric_limits<double>::infinity();
}
void changeReport(mongocxx::database& db, const std::string& code,
                  const Staff& staff, const std::string& action,
                  const std::string& stage, const std::string& note,
                  const json& fields, const std::string& reason = "",
                  const std::string& previous = "", const std::string& next = "") {
    json update = {{"$set", fields}, {"$push", {{"hist", history(stage, note, staff.name)}}}};
    update["$set"]["updated_at"] = nowDate();
    updateOne(db["reports"], {{"code", code}}, update);
    addAudit(db, staff, action, code, reason, previous, next);
}
json userView(const json& user) {
    return {
        {"id", text(user, "id")}, {"type", text(user, "type")},
        {"name", text(user, "name")}, {"role", text(user, "role", "Citizen")},
        {"ident", text(user, "ident")}, {"disabled", boolean(user, "disabled")},
        {"created_at", user.value("created_at", json(nullptr))}
    };
}
long long activeAdmins(mongocxx::database& db) {
    long long count = 0;
    for (const auto& user : findMany(db["users"], {{"type", "staff"}}))
        if (text(user, "role") == "Admin" && !boolean(user, "disabled")) ++count;
    return count;
}
} // namespace
void OpsRouter::registerRoutes(httplib::Server& server, mongocxx::database& db) {
    server.Get("/api/ops/queue", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff)) return;
        json items = findMany(db["reports"]);
        std::stable_sort(items.begin(), items.end(), [](const json& a, const json& b) {
            return dateMilliseconds(a.value("created_at", json(nullptr))) >
                   dateMilliseconds(b.value("created_at", json(nullptr)));
        });
        if (items.size() > 1000) items.erase(items.begin() + 1000, items.end());
        const std::string status = req.get_param_value("status");
        const std::string severity = req.get_param_value("severity");
        const std::string category = req.get_param_value("category");
        const std::string search = lower(req.get_param_value("q"));
        const std::string sort = req.get_param_value("sort");
        json filtered = json::array();
        for (auto item : items) {
            if (!status.empty() && text(item, "status") != status) continue;
            if (!severity.empty() && text(item, "severity") != severity) continue;
            if (!category.empty() && text(item, "category") != category) continue;
            const std::string searchable = lower(text(item, "code") + " " + text(item, "text") + " " + text(item.value("loc", json::object()), "address"));
            if (!search.empty() && searchable.find(search) == std::string::npos) continue;
            filtered.push_back(clean(item));
        }
        if (sort.empty() || sort == "pri") {
            std::stable_sort(filtered.begin(), filtered.end(), [](const json& a, const json& b) {
                return severityRank(text(a, "severity")) > severityRank(text(b, "severity"));
            });
        }
        send(res, {{"items", filtered}, {"total", filtered.size()}});
    });
    server.Get(R"(/api/ops/incident/([^/]+))", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff)) return;
        if (!incidentExists(db, req.matches[1], res, report)) return;
        send(res, clean(report));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/ack)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "ack") || !incidentExists(db, req.matches[1], res, report)) return;
        const std::string code = req.matches[1];
        if (text(report, "status") != "Reported") { fail(res, 409, "Cannot acknowledge from " + text(report, "status") + "."); return; }
        json body = readBody(req); const std::string reason = text(body, "reason");
        changeReport(db, code, staff, "Acknowledged", "Acknowledged",
                     reason.empty() ? "Operator acknowledged" : reason,
                     {{"status", "Acknowledged"}}, reason, "Reported", "Acknowledged");
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/status)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "review_st") || !incidentExists(db, req.matches[1], res, report)) return;
        json body = readBody(req); const std::string next = text(body, "status");
        if (next.empty()) { fail(res, 422, "Status is required."); return; }
        static const std::unordered_map<std::string, std::set<std::string>> allowed = {
            {"Reported", {"Acknowledged", "Under review"}},
            {"Acknowledged", {"Under review", "Assigned", "Resolved"}},
            {"Under review", {"Acknowledged", "Assigned", "Resolved"}},
            {"Assigned", {"En route", "On scene", "Resolved"}},
            {"En route", {"On scene", "Resolved"}}, {"On scene", {"Resolved"}},
            {"Resolved", {"Closed"}}, {"Closed", {}}
        };
        const std::string old = text(report, "status");
        if (!allowed.count(old) || !allowed.at(old).count(next)) { fail(res, 409, "Invalid incident status transition."); return; }
        const std::string code = req.matches[1], reason = text(body, "reason");
        if ((next == "En route" || next == "On scene") && report.contains("unit") && report["unit"].is_string())
            updateOne(db["units"], {{"id", report["unit"]}}, {{"$set", {{"stat", next}}}});
        changeReport(db, code, staff, "Status -> " + next, next,
                     reason.empty() ? "Status updated by " + staff.name : reason,
                     {{"status", next}}, reason, old, next);
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/priority)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "prio") || !incidentExists(db, req.matches[1], res, report)) return;
        json body = readBody(req); const std::string next = text(body, "severity");
        if (next.empty()) { fail(res, 422, "Severity is required."); return; }
        const std::set<std::string> valid = {"Critical", "High", "Medium", "Low"};
        if (!valid.count(next)) { fail(res, 422, "Unknown severity."); return; }
        const std::string old = text(report, "severity");
        if (old == next) { fail(res, 409, "Priority is already set to that value."); return; }
        const std::string code = req.matches[1];
        changeReport(db, code, staff, "Priority change", "Priority change", old + " -> " + next,
                     {{"severity", next}}, text(body, "reason"), old, next);
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/assign)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "assign") || !incidentExists(db, req.matches[1], res, report)) return;
        if (!activeStatus(text(report, "status"))) { fail(res, 409, "This incident is closed."); return; }
        json body = readBody(req); const std::string unitId = text(body, "unit_id");
        if (unitId.empty()) { fail(res, 422, "Unit ID is required."); return; }
        json unit = findOne(db["units"], {{"id", unitId}});
        if (unit.is_null()) { fail(res, 404, "No such response unit."); return; }
        const std::string need = serviceFor(text(report, "category"));
        if (!need.empty() && text(unit, "svc") != need) { fail(res, 400, "This response unit is not suitable for the incident category."); return; }
        if (!boolean(unit, "active", true)) { fail(res, 400, "This response unit is deactivated."); return; }
        const double km = roadDistance(text(unit, "node"), text(report, "node"));
        if (!std::isfinite(km)) { fail(res, 409, "No road path from that unit's base on the sample graph."); return; }
        const std::string code = req.matches[1], oldUnit = text(report, "unit"), oldStatus = text(report, "status");
        std::string nextStatus = oldStatus;
        if (oldStatus == "Reported" || oldStatus == "Acknowledged" || oldStatus == "Under review") nextStatus = "Assigned";
        if (!oldUnit.empty() && oldUnit != unitId)
            updateOne(db["units"], {{"id", oldUnit}}, {{"$set", {{"stat", "Available"}}}});
        updateOne(db["units"], {{"id", unitId}}, {{"$set", {{"stat", nextStatus}}}});
        const std::string action = oldUnit.empty() ? "Unit assigned" : "Unit reassigned";
        const std::string note = unitId + " (" + text(unit, "facility") + ") - shortest path " +
            std::to_string(km) + " km; estimated " + std::to_string(std::max(1, static_cast<int>(std::round(km * 60 / 21)))) + " min (sample graph)";
        changeReport(db, code, staff, action, action, note,
                     {{"unit", unitId}, {"status", nextStatus}, {"route_km", std::round(km * 100) / 100}},
                     text(body, "reason"), oldUnit + " / " + oldStatus, unitId + " / " + nextStatus);
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/resolve)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "resolve") || !incidentExists(db, req.matches[1], res, report)) return;
        if (!activeStatus(text(report, "status"))) { fail(res, 409, "This incident is already closed."); return; }
        if (!text(report, "unit").empty()) updateOne(db["units"], {{"id", text(report, "unit")}}, {{"$set", {{"stat", "Available"}}}});
        json body = readBody(req); const std::string reason = text(body, "reason");
        const std::string old = text(report, "status"), code = req.matches[1];
        changeReport(db, code, staff, "Resolved", "Resolved", reason.empty() ? "Resolved by " + staff.name : reason,
                     {{"status", "Resolved"}}, reason, old, "Resolved");
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/close)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "resolve") || !incidentExists(db, req.matches[1], res, report)) return;
        if (text(report, "status") != "Resolved") { fail(res, 409, "Resolve the incident before closing it."); return; }
        json body = readBody(req); const std::string reason = text(body, "reason"), code = req.matches[1];
        changeReport(db, code, staff, "Closed", "Closed", reason.empty() ? "Closed by " + staff.name : reason,
                     {{"status", "Closed"}}, reason, "Resolved", "Closed");
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/reopen)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "reopen") || !incidentExists(db, req.matches[1], res, report)) return;
        const std::string old = text(report, "status");
        if (old != "Resolved" && old != "Closed") { fail(res, 409, "Only resolved or closed incidents can be reopened."); return; }
        json body = readBody(req); const std::string reason = text(body, "reason"), code = req.matches[1];
        changeReport(db, code, staff, "Reopened", "Reopened", reason.empty() ? "Reopened by " + staff.name : reason,
                     {{"status", "Under review"}}, reason, old, "Under review");
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/note)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "note") || !incidentExists(db, req.matches[1], res, report)) return;
        const std::string note = trim(text(readBody(req), "text"));
        if (note.empty() || note.size() > 500) { fail(res, 422, "Note must contain 1 to 500 characters."); return; }
        const std::string code = req.matches[1];
        addHistory(db, code, "Internal note", note, staff);
        addAudit(db, staff, "Internal note", code, note.substr(0, 120));
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/reply)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "note") || !incidentExists(db, req.matches[1], res, report)) return;
        const std::string message = trim(text(readBody(req), "text"));
        if (message.empty() || message.size() > 500) { fail(res, 422, "Reply must contain 1 to 500 characters."); return; }
        json reply = {{"id", newId("REP-")}, {"ts", nowDate()},
                      {"by", staff.name}, {"role", "staff"}, {"text", message}};
        updateOne(db["reports"], {{"code", req.matches[1]}},
            {{"$set", {{"updated_at", nowDate()}}}, {"$push", {{"replies", reply}}}});
        addAudit(db, staff, "Reply sent to reporter", req.matches[1], message.substr(0, 120));
        send(res, getUpdatedReport(db, req.matches[1]));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/review)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "rview") || !incidentExists(db, req.matches[1], res, report)) return;
        json body = readBody(req); const std::string decision = text(body, "decision");
        if (decision.empty()) { fail(res, 422, "Review decision is required."); return; }
        if (decision != "cleared" && decision != "needs-review" && decision != "escalated") { fail(res, 422, "Unknown review decision."); return; }
        if (decision == "escalated" && !hasPermission(staff.role, "reopen")) { fail(res, 403, "Escalation requires a supervisor."); return; }
        const bool needsReview = decision != "cleared";
        std::string note = text(body, "note");
        if (note.empty()) note = decision == "cleared" ? "Reviewed - no further action" :
            (decision == "needs-review" ? "Needs further review" : "Escalated for supervisor review");
        const std::string code = req.matches[1];
        changeReport(db, code, staff, "Risk review: " + note, "Risk review", note,
                     {{"needs_review", needsReview}}, text(body, "note"),
                     "needs_review=" + std::string(boolean(report, "needs_review") ? "true" : "false"),
                     needsReview ? "needs_review=true" : "needs_review=false");
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/flag)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "flag") || !incidentExists(db, req.matches[1], res, report)) return;
        json body = readBody(req);
        if (!body.contains("flag") || !body["flag"].is_boolean()) { fail(res, 422, "A boolean flag value is required."); return; }
        const bool flag = boolean(body, "flag");
        const std::string reason = text(body, "reason"), code = req.matches[1];
        changeReport(db, code, staff, flag ? "Flagged for attention" : "Flag removed",
                     flag ? "Flagged" : "Flag removed", reason,
                     {{"flag", flag}, {"flag_reason", flag ? json(reason) : json(nullptr)}},
                     reason, boolean(report, "flag") ? "flag=true" : "flag=false",
                     flag ? "flag=true" : "flag=false");
        send(res, getUpdatedReport(db, code));
    });
    server.Post(R"(/api/ops/incident/([^/]+)/link)", [&db](const auto& req, auto& res) {
        Staff staff; json report;
        if (!getStaff(req, res, db, staff, "link") || !incidentExists(db, req.matches[1], res, report)) return;
        json body = readBody(req); const std::string otherCode = text(body, "other_code"), code = req.matches[1];
        if (otherCode.empty()) { fail(res, 422, "Other report reference is required."); return; }
        if (otherCode == code) { fail(res, 400, "An incident cannot link to itself."); return; }
        if (findOne(db["reports"], {{"code", otherCode}}).is_null()) { fail(res, 404, "No report with that reference to link."); return; }
        json risk = report.value("risk", json::object());
        const int score = std::min(100, risk.value("score", 0) + 25);
        json signals = risk.value("signals", json::array());
        signals.push_back({{"id", "dup-link"}, {"kind", "observed"}, {"weight", 25},
                           {"text", "Linked as possible duplicate of " + otherCode + "."}});
        const std::string level = score >= 60 ? "high" : (score >= 25 ? "medium" : "low");
        changeReport(db, code, staff, "Linked possible duplicate", "Linked",
                     "Possible duplicate of " + otherCode,
                     {{"link", otherCode}, {"risk", {{"score", score}, {"level", level}, {"signals", signals}}}},
                     text(body, "reason"), text(report, "link", "-"), otherCode);
        send(res, getUpdatedReport(db, code));
    });
    server.Get("/api/ops/units", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff)) return;
        json result = findMany(db["units"]);
        std::sort(result.begin(), result.end(), [](const json& a, const json& b) { return text(a, "id") < text(b, "id"); });
        if (result.size() > 200) result.erase(result.begin() + 200, result.end());
        for (auto& unit : result) unit = clean(unit);
        send(res, result);
    });
    server.Post(R"(/api/ops/units/([^/]+)/status)", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff, "unit")) return;
        const std::string id = req.matches[1]; json unit = findOne(db["units"], {{"id", id}});
        if (unit.is_null()) { fail(res, 404, "No such unit."); return; }
        json body = readBody(req); const std::string status = text(body, "stat");
        const std::set<std::string> valid = {"Available", "Assigned", "En route", "On scene", "Temporarily unavailable", "Offline / location stale"};
        if (!valid.count(status)) { fail(res, 422, "Unknown unit status."); return; }
        updateOne(db["units"], {{"id", id}}, {{"$set", {{"stat", status}}}});
        addAudit(db, staff, "Unit status changed", id, text(body, "reason"), text(unit, "stat"), status);
        send(res, clean(findOne(db["units"], {{"id", id}})));
    });
    server.Post(R"(/api/ops/units/([^/]+)/active)", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff, "unit")) return;
        const std::string id = req.matches[1]; json unit = findOne(db["units"], {{"id", id}});
        if (unit.is_null()) { fail(res, 404, "No such unit."); return; }
        const json body = readBody(req);
        if (!body.contains("active") || !body["active"].is_boolean()) { fail(res, 422, "Active must be true or false."); return; }
        const bool active = boolean(body, "active");
        updateOne(db["units"], {{"id", id}}, {{"$set", {{"active", active}}}});
        addAudit(db, staff, active ? "Unit reactivated" : "Unit deactivated", id, "",
                 boolean(unit, "active", true) ? "active=true" : "active=false",
                 active ? "active=true" : "active=false");
        send(res, clean(findOne(db["units"], {{"id", id}})));
    });
    server.Get("/api/ops/audit", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff)) return;
        const std::string actor = lower(req.get_param_value("actor"));
        const std::string action = lower(req.get_param_value("action"));
        const std::string target = lower(req.get_param_value("target"));
        json result = findMany(db["audit"]);
        json filtered = json::array();
        for (auto item : result) {
            if (!actor.empty() && lower(text(item, "actor")).find(actor) == std::string::npos) continue;
            if (!action.empty() && lower(text(item, "action")).find(action) == std::string::npos) continue;
            if (!target.empty() && lower(text(item, "target")).find(target) == std::string::npos) continue;
            filtered.push_back(clean(item));
        }
        std::sort(filtered.begin(), filtered.end(), [](const json& a, const json& b) { return a.value("n", 0) > b.value("n", 0); });
        if (filtered.size() > 300) filtered.erase(filtered.begin() + 300, filtered.end());
        send(res, filtered);
    });
    server.Get("/api/ops/analytics", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff)) return;
        json reports = findMany(db["reports"]), units = findMany(db["units"]);
        if (reports.size() > 5000) reports.erase(reports.begin() + 5000, reports.end());
        if (units.size() > 200) units.erase(units.begin() + 200, units.end());
        json byStatus = json::object(), bySeverity = json::object(), byCategory = json::object();
        int active = 0, resolved = 0, available = 0;
        double ackTotal = 0.0;
        int ackCount = 0;
        for (const auto& report : reports) {
            const std::string status = text(report, "status"), severity = text(report, "severity"), category = text(report, "category");
            byStatus[status] = byStatus.value(status, 0) + 1;
            bySeverity[severity] = bySeverity.value(severity, 0) + 1;
            byCategory[category] = byCategory.value(category, 0) + 1;
            if (activeStatus(status)) ++active;
            if (status == "Resolved" || status == "Closed") ++resolved;
            const long long created = dateMilliseconds(report.value("created_at", json(nullptr)));
            if (report.contains("hist") && report["hist"].is_array()) {
                for (const auto& entry : report["hist"]) {
                    if (text(entry, "stage") != "Acknowledged") continue;
                    const long long acknowledged = dateMilliseconds(entry.value("ts", json(nullptr)));
                    const long long difference = acknowledged - created;
                    if (created > 0 && difference >= 0 && difference < 86400000) {
                        ackTotal += difference / 60000.0;
                        ++ackCount;
                        break;
                    }
                }
            }
        }
        for (const auto& unit : units) if (text(unit, "stat") == "Available" && boolean(unit, "active", true)) ++available;
        send(res, {{"total", reports.size()}, {"active", active}, {"resolved", resolved},
                   {"by_status", byStatus}, {"by_severity", bySeverity}, {"by_category", byCategory},
                   {"avg_ack_min", ackCount ? json(std::round((ackTotal / ackCount) * 10.0) / 10.0) : json(nullptr)},
                   {"units_available", available}, {"units_total", units.size()}});
    });
    server.Get("/api/ops/users", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff, "users")) return;
        json users = findMany(db["users"]), result = json::array();
        std::sort(users.begin(), users.end(), [](const json& a, const json& b) {
            return dateMilliseconds(a.value("created_at", json(nullptr))) <
                   dateMilliseconds(b.value("created_at", json(nullptr)));
        });
        if (users.size() > 500) users.erase(users.begin() + 500, users.end());
        for (const auto& user : users) result.push_back(clean(userView(user)));
        send(res, result);
    });
    server.Post(R"(/api/ops/users/([^/]+)/role)", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff, "users")) return;
        const std::string id = req.matches[1]; json user = findOne(db["users"], {{"id", id}});
        if (user.is_null() || text(user, "type") != "staff") { fail(res, 404, "No such staff account."); return; }
        json body = readBody(req); const std::string role = text(body, "role");
        if (role.empty()) { fail(res, 422, "Role is required."); return; }
        const std::set<std::string> valid = {"Dispatcher", "Supervisor", "Admin", "Read-only analyst"};
        if (!valid.count(role)) { fail(res, 422, "Unknown role."); return; }
        if (text(user, "role") == "Admin" && role != "Admin" && activeAdmins(db) <= 1) {
            fail(res, 409, "At least one active administrator is required."); return;
        }
        updateOne(db["users"], {{"id", id}}, {{"$set", {{"role", role}}}});
        addAudit(db, staff, "Role change", text(user, "ident"), text(body, "reason"), text(user, "role"), role);
        send(res, clean(userView(findOne(db["users"], {{"id", id}}))));
    });
    server.Post(R"(/api/ops/users/([^/]+)/disabled)", [&db](const auto& req, auto& res) {
        Staff staff;
        if (!getStaff(req, res, db, staff, "users")) return;
        const std::string id = req.matches[1]; json user = findOne(db["users"], {{"id", id}});
        if (user.is_null() || text(user, "type") != "staff") { fail(res, 404, "No such staff account."); return; }
        const json body = readBody(req);
        if (!body.contains("disabled") || !body["disabled"].is_boolean()) { fail(res, 422, "Disabled must be true or false."); return; }
        const bool disabled = boolean(body, "disabled");
        if (disabled && text(user, "role") == "Admin" && activeAdmins(db) <= 1) {
            fail(res, 409, "At least one active administrator is required."); return;
        }
        updateOne(db["users"], {{"id", id}}, {{"$set", {{"disabled", disabled}}}});
        addAudit(db, staff, disabled ? "Account disabled" : "Account enabled", text(user, "ident"), "",
                 boolean(user, "disabled") ? "disabled=true" : "disabled=false",
                 disabled ? "disabled=true" : "disabled=false");
        send(res, clean(userView(findOne(db["users"], {{"id", id}}))));
    });
}
} // namespace ease::ops
