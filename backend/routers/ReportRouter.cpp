#include "ReportRouter.h"
#include "CityGraphData.h"
#include "json.hpp"

#include <bsoncxx/json.hpp>
#include <mongocxx/collection.hpp>

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cmath>
#include <queue>
#include <limits>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <random>
#include <string>
#include <unordered_map>
#include <vector>

namespace ease::reports {
namespace {
using json = nlohmann::json;

long long nowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}

json nowDate() {
    return {{"$date", {{"$numberLong", std::to_string(nowMs())}}}};
}

std::string nowIso() {
    const std::time_t now = std::time(nullptr);
    std::tm utc{};
#ifdef _WIN32
    gmtime_s(&utc, &now);
#else
    gmtime_r(&now, &utc);
#endif
    std::ostringstream out;
    out << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
    return out.str();
}

std::string makeId() {
    static std::mt19937_64 rng(std::random_device{}());
    static const char* digits = "0123456789abcdef";
    std::string id;
    for (int i = 0; i < 32; ++i) id += digits[rng() % 16];
    return id;
}

std::string makeCode() {
    static std::mt19937 rng(std::random_device{}());
    static const char* digits = "0123456789ABCDEF";
    std::string code = "RPT-";
    for (int i = 0; i < 6; ++i) code += digits[rng() % 16];
    return code;
}

std::string trim(std::string value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    return value.substr(first, value.find_last_not_of(" \t\r\n") - first + 1);
}

std::string lower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(),
        [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return value;
}

std::string digitsOnly(const std::string& value) {
    std::string result;
    for (unsigned char c : value)
        if (std::isdigit(c)) result += static_cast<char>(c);
    if (result.size() > 10) result = result.substr(result.size() - 10);
    return result;
}

std::string str(const json& value, const std::string& key,
                const std::string& fallback = "") {
    return value.contains(key) && value[key].is_string()
        ? value[key].get<std::string>() : fallback;
}

double number(const json& value, const std::string& key, double fallback) {
    return value.contains(key) && value[key].is_number()
        ? value[key].get<double>() : fallback;
}

json readBody(const httplib::Request& req) {
    try {
        auto value = json::parse(req.body);
        return value.is_object() ? value : json::object();
    } catch (...) {
        return json::object();
    }
}

void send(httplib::Response& res, const json& value, int status = 200) {
    res.status = status;
    res.set_content(value.dump(), "application/json");
}

void fail(httplib::Response& res, int status, const std::string& message) {
    send(res, {{"detail", message}}, status);
}

json findOne(mongocxx::collection collection, const json& filter) {
    auto query = bsoncxx::from_json(filter.dump());
    auto result = collection.find_one(query.view());
    if (!result) return nullptr;
    json value = json::parse(bsoncxx::to_json(*result));
    value.erase("_id");
    return value;
}

json findMany(mongocxx::collection collection, const json& filter) {
    auto query = bsoncxx::from_json(filter.dump());
    json values = json::array();
    for (const auto& item : collection.find(query.view())) {
        json value = json::parse(bsoncxx::to_json(item));
        value.erase("_id");
        values.push_back(std::move(value));
    }
    return values;
}

void insert(mongocxx::collection collection, const json& value) {
    auto document = bsoncxx::from_json(value.dump());
    collection.insert_one(document.view());
}

void update(mongocxx::collection collection, const json& filter,
            const json& changes) {
    auto query = bsoncxx::from_json(filter.dump());
    auto value = bsoncxx::from_json(changes.dump());
    collection.update_one(query.view(), value.view());
}

std::string cookie(const httplib::Request& req) {
    const std::string all = req.get_header_value("Cookie");
    const std::string key = "ease_session=";
    const auto start = all.find(key);
    if (start == std::string::npos) return "";
    const auto valueStart = start + key.size();
    const auto end = all.find(';', valueStart);
    return all.substr(valueStart, end == std::string::npos ? end : end - valueStart);
}

json currentUser(const httplib::Request& req, mongocxx::database& db) {
    const std::string token = cookie(req);
    if (token.empty()) return nullptr;
    json session = findOne(db["sessions"], {
        {"token", token}, {"expires_at", {{"$gt", nowDate()}}}
    });
    if (session.is_null()) return nullptr;
    json user = findOne(db["users"], {{"id", str(session, "user_id")}});
    if (user.is_null() || user.value("disabled", false)) return nullptr;
    return user;
}

bool owns(const json& report, const json& user, const std::string& phone) {
    if (!user.is_null() && str(user, "type") == "staff") return true;
    if (!user.is_null() && str(user, "type") == "citizen" &&
        str(report, "acct") == str(user, "id")) return true;
    const std::string saved = digitsOnly(str(report, "phone"));
    return !phone.empty() && !saved.empty() && saved == digitsOnly(phone);
}

std::string severityFor(const std::string& urgency, const std::string& text) {
    if (urgency == "life") return "Critical";
    const std::string s = lower(text);
    if (s.find("unconscious") != std::string::npos ||
        s.find("multiple injured") != std::string::npos ||
        s.find("trapped") != std::string::npos ||
        s.find("major fire") != std::string::npos) return "High";
    if (urgency == "urgent" || s.find("injury") != std::string::npos ||
        s.find("accident") != std::string::npos ||
        s.find("smoke") != std::string::npos) return "Medium";
    return "Low";
}

std::string categoryLabel(const std::string& category) {
    static const std::unordered_map<std::string, std::string> labels = {
        {"medical", "Medical"}, {"accident", "Road accident"},
        {"fire", "Fire"}, {"violence", "Violence / threat"},
        {"theft", "Crime / theft"}, {"flood", "Flood / disaster"},
        {"ev", "Vehicle breakdown"}, {"other", "Other"}
    };
    auto it = labels.find(category);
    return it == labels.end() ? "Other" : it->second;
}

std::string nearestNode(double x, double y) {
    std::string best = routing::kCenterNode;
    double bestDistance = std::numeric_limits<double>::max();
    for (const auto& [id, point] : routing::kNodes) {
        const double dx = point.x - x, dy = point.y - y;
        const double distance = dx * dx + dy * dy;
        if (distance < bestDistance) { bestDistance = distance; best = id; }
    }
    return best;
}

json history(const std::string& stage, const std::string& note,
             const std::string& actor) {
    return {{"ts", nowIso()}, {"stage", stage}, {"note", note}, {"actor", actor}};
}

json publicReport(const json& report, bool full) {
    json result = {
        {"code", str(report, "code")}, {"category", str(report, "category")},
        {"label", str(report, "label")}, {"severity", str(report, "severity")},
        {"status", str(report, "status")}, {"unit", report.value("unit", json(nullptr))},
        {"created_at", report.value("created_at", json(nullptr))},
        {"hist", report.value("hist", json::array())},
        {"replies", report.value("replies", json::array())},
        {"loc_note", report.value("loc", json::object()).value("address", json(nullptr))},
        {"node", report.value("node", json(nullptr))}, {"full", full}
    };
    result["text"] = full ? report.value("text", json(nullptr)) : json(nullptr);
    return result;
}

} // namespace

void ReportRouter::registerRoutes(httplib::Server& server, mongocxx::database& db) {
    // Create an emergency report. Guest reporting is allowed.
    server.Post("/api/reports", [&db](const httplib::Request& req, httplib::Response& res) {
        const json body = readBody(req);
        const std::string text = trim(str(body, "text"));
        if (text.size() < 5 || text.size() > 2000) {
            fail(res, 422, "Describe the emergency in 5 to 2000 characters."); return;
        }

        std::string category = str(body, "category", "other");
        static const std::vector<std::string> categories = {
            "medical", "accident", "fire", "violence", "theft", "flood", "ev", "other"
        };
        if (std::find(categories.begin(), categories.end(), category) == categories.end())
            category = "other";
        std::string urgency = str(body, "urgency", "info");
        if (urgency != "life" && urgency != "urgent" && urgency != "info") urgency = "info";

        json loc = body.value("loc", json::object());
        json details = body.value("details", json::object());
        if (!loc.is_object()) loc = json::object();
        if (!details.is_object()) details = json::object();
        const double mapX = number(loc, "map_x", 315.0);
        const double mapY = number(loc, "map_y", 184.0);
        const std::string node = nearestNode(mapX, mapY);
        const json user = currentUser(req, db);
        const std::string code = makeCode();
        const std::string id = makeId();
        const std::string severity = severityFor(urgency, text);

        json report = {
            {"id", id}, {"code", code}, {"category", category},
            {"label", categoryLabel(category)}, {"urgency", urgency},
            {"severity", severity}, {"text", text}, {"status", "Reported"},
            {"node", node}, {"loc", loc}, {"details", details},
            {"reporter_name", body.value("reporter_name", json(nullptr))},
            {"phone", body.value("phone", json(nullptr))},
            {"acct", (!user.is_null() && str(user, "type") == "citizen") ? str(user, "id") : "guest"},
            {"unit", nullptr}, {"route_km", nullptr},
            {"risk", {{"score", 0}, {"level", "low"}, {"signals", json::array()}}},
            {"needs_review", false}, {"flag", false}, {"flag_reason", nullptr},
            {"link", nullptr}, {"sample", false}, {"created_at", nowIso()},
            {"updated_at", nowIso()},
            {"hist", json::array({history("Reported", "Emergency report received", "Citizen")})},
            {"replies", json::array()}
        };
        try { insert(db["reports"], report); }
        catch (const std::exception& e) { fail(res, 500, e.what()); return; }
        send(res, report, 201);
    });

    // List reports belonging to the signed-in citizen.
    server.Get("/api/reports/mine", [&db](const httplib::Request& req, httplib::Response& res) {
        json user = currentUser(req, db);
        if (user.is_null() || str(user, "type") != "citizen") {
            fail(res, 401, "Sign in as a citizen to view your reports."); return;
        }
        json reports = findMany(db["reports"], {{"acct", str(user, "id")}});
        std::sort(reports.begin(), reports.end(), [](const json& a, const json& b) {
            return a.value("created_at", json()) > b.value("created_at", json());
        });
        send(res, reports);
    });

    // Track a report. Owners and staff receive the full details.
    server.Get(R"(/api/reports/([^/]+))", [&db](const httplib::Request& req, httplib::Response& res) {
        const std::string code = req.matches[1];
        json report = findOne(db["reports"], {{"code", code}});
        if (report.is_null()) { fail(res, 404, "Report not found."); return; }
        json user = currentUser(req, db);
        const std::string phone = req.has_param("phone") ? req.get_param_value("phone") : "";
        const bool full = owns(report, user, phone);
        send(res, publicReport(report, full));
    });

    // Cancel a report only while it is Reported or Acknowledged.
    server.Post(R"(/api/reports/([^/]+)/cancel)", [&db](const httplib::Request& req, httplib::Response& res) {
        const std::string code = req.matches[1];
        json report = findOne(db["reports"], {{"code", code}});
        if (report.is_null()) { fail(res, 404, "Report not found."); return; }
        const json body = readBody(req);
        json user = currentUser(req, db);
        if (!owns(report, user, str(body, "phone"))) { fail(res, 403, "Only the reporter can cancel this report."); return; }
        const std::string status = str(report, "status");
        if (status != "Reported" && status != "Acknowledged") {
            fail(res, 409, "This report can no longer be cancelled."); return;
        }
        update(db["reports"], {{"code", code}}, {{"$set", {
            {"status", "Cancelled"}, {"updated_at", nowIso()}
        }}, {"$push", {{"hist", history("Cancelled", str(body, "reason", "Cancelled by reporter"), "Reporter")}}}});
        send(res, findOne(db["reports"], {{"code", code}}));
    });

    // Add a reply from the reporter.
    server.Post(R"(/api/reports/([^/]+)/reply)", [&db](const httplib::Request& req, httplib::Response& res) {
        const std::string code = req.matches[1];
        json report = findOne(db["reports"], {{"code", code}});
        if (report.is_null()) { fail(res, 404, "Report not found."); return; }
        const json body = readBody(req);
        json user = currentUser(req, db);
        if (!owns(report, user, str(body, "phone"))) { fail(res, 403, "Only the reporter can reply to this report."); return; }
        const std::string message = trim(str(body, "text"));
        if (message.empty() || message.size() > 500) { fail(res, 422, "Reply must contain 1 to 500 characters."); return; }
        json reply = {{"id", makeId()}, {"ts", nowIso()},
            {"by", !user.is_null() ? str(user, "name", "Reporter") : "Reporter"},
            {"role", "Citizen"}, {"text", message}};
        update(db["reports"], {{"code", code}}, {{"$set", {{"updated_at", nowIso()}}}, {"$push", {{"replies", reply}}}});
        send(res, findOne(db["reports"], {{"code", code}}));
    });
}

} // namespace ease::reports
