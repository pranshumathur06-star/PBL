#include "AuthRouter.h"
#include "json.hpp"
#include <bsoncxx/json.hpp>
#include <mongocxx/collection.hpp>
#include <mongocxx/options/update.hpp>
#include <openssl/evp.h>
#include <openssl/rand.h>
#include <openssl/crypto.h>
#include <algorithm>
#include <chrono>
#include <cctype>
#include <iomanip>
#include <regex>
#include <sstream>
#include <string>

namespace ease::auth {
namespace {
using json = nlohmann::json;
constexpr int PBKDF2_ITERS = 120000;
constexpr int OTP_TTL = 600;
constexpr int LOCK_SECONDS = 300;
constexpr int MAX_ATTEMPTS = 5;
const std::string COOKIE = "ease_session";

long long nowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
}
json dateAfter(int seconds) {
    return {{"$date", {{"$numberLong", std::to_string(nowMs() + seconds * 1000LL)}}}};
}
std::string hex(const unsigned char* data, int size) {
    std::ostringstream out;
    out << std::hex << std::setfill('0');
    for (int i = 0; i < size; ++i) out << std::setw(2) << (int)data[i];
    return out.str();
}
std::string randomHex(int bytes) {
    unsigned char data[32];
    if (bytes > 32 || RAND_bytes(data, bytes) != 1) return "";
    return hex(data, bytes);
}
std::string randomToken() {
    unsigned char data[32];
    if (RAND_bytes(data, sizeof(data)) != 1) return "";
    static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    std::string out;
    unsigned int value = 0, bits = 0;
    for (unsigned char c : data) {
        value = (value << 8) | c; bits += 8;
        while (bits >= 6) { bits -= 6; out += table[(value >> bits) & 63]; }
    }
    if (bits) out += table[(value << (6 - bits)) & 63];
    return out;
}
std::string trim(std::string s) {
    size_t a = s.find_first_not_of(" \t\r\n"), b = s.find_last_not_of(" \t\r\n");
    return a == std::string::npos ? "" : s.substr(a, b - a + 1);
}
std::string lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::tolower(c); });
    return s;
}
std::string field(const json& j, const char* key) {
    return j.contains(key) && j[key].is_string() ? j[key].get<std::string>() : "";
}
json body(const httplib::Request& req) {
    try { return json::parse(req.body); } catch (...) { return json::object(); }
}
void send(httplib::Response& res, const json& value, int status = 200) {
    res.status = status;
    res.set_content(value.dump(), "application/json");
}
void error(httplib::Response& res, int status, const std::string& message) {
    send(res, {{"detail", message}}, status);
}
json findOne(mongocxx::collection col, const json& filter) {
    auto query = bsoncxx::from_json(filter.dump());
    auto result = col.find_one(query.view());
    if (!result) return nullptr;
    json value = json::parse(bsoncxx::to_json(*result));
    value.erase("_id");
    return value;
}
void insert(mongocxx::collection col, const json& value) {
    auto doc = bsoncxx::from_json(value.dump());
    col.insert_one(doc.view());
}
void update(mongocxx::collection col, const json& filter, const json& changes, bool upsert = false) {
    auto q = bsoncxx::from_json(filter.dump());
    auto u = bsoncxx::from_json(changes.dump());
    mongocxx::options::update options;
    options.upsert(upsert);
    col.update_one(q.view(), u.view(), options);
}
void erase(mongocxx::collection col, const json& filter) {
    auto q = bsoncxx::from_json(filter.dump());
    col.delete_one(q.view());
}
bool validPassword(const std::string& p) {
    return p.size() >= 8 && std::any_of(p.begin(), p.end(), [](unsigned char c) { return std::isalpha(c); }) &&
           std::any_of(p.begin(), p.end(), [](unsigned char c) { return std::isdigit(c); });
}
bool validPhone(const std::string& p) { return std::regex_match(p, std::regex("^[6-9][0-9]{9}$")); }
bool validEmail(const std::string& e) { return std::regex_match(e, std::regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")); }
std::string passwordHash(const std::string& password, const std::string& salt, int iters) {
    unsigned char digest[32];
    if (PKCS5_PBKDF2_HMAC(password.c_str(), (int)password.size(),
            reinterpret_cast<const unsigned char*>(salt.data()), (int)salt.size(),
            iters, EVP_sha256(), sizeof(digest), digest) != 1) return "";
    return hex(digest, sizeof(digest));
}
bool verifyPassword(const std::string& password, const json& user) {
    std::string salt = field(user, "salt"), expected = field(user, "hash");
    int iters = user.value("iters", PBKDF2_ITERS);
    if (salt.empty() || expected.empty() || iters <= 0) return false;
    std::string actual = passwordHash(password, salt, iters);
    return actual.size() == expected.size() && CRYPTO_memcmp(actual.data(), expected.data(), actual.size()) == 0;
}
json publicUser(const json& u) {
    return {{"id", field(u, "id")}, {"type", field(u, "type")},
            {"name", field(u, "name")}, {"role", u.value("role", "Citizen")},
            {"ident", field(u, "ident")}};
}
std::string cookieToken(const httplib::Request& req) {
    std::string cookies = req.get_header_value("Cookie");
    std::regex pattern("(?:^|;\\s*)ease_session=([^;]+)");
    std::smatch match;
    return std::regex_search(cookies, match, pattern) ? match[1].str() : "";
}
void setSession(httplib::Response& res, mongocxx::database& db, const std::string& userId) {
    std::string token = randomToken();
    if (token.empty()) return;
    insert(db["sessions"], {{"token", token}, {"user_id", userId}, {"expires_at", dateAfter(8 * 60 * 60)}});
    res.set_header("Set-Cookie", COOKIE + "=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800");
}
json principal(const httplib::Request& req, mongocxx::database& db) {
    std::string token = cookieToken(req);
    if (token.empty()) return nullptr;
    json session = findOne(db["sessions"], {{"token", token}, {"expires_at", {{"$gt", dateAfter(0)}}}});
    if (session.is_null()) return nullptr;
    json user = findOne(db["users"], {{"id", field(session, "user_id")}});
    if (user.is_null() || user.value("disabled", false)) return nullptr;
    return publicUser(user);
}
void login(httplib::Response& res, mongocxx::database& db, const std::string& type,
           const std::string& ident, const std::string& password) {
    std::string key = type + ":" + (type == "staff" ? lower(ident) : ident);
    json fails = findOne(db["login_fails"], {{"key", key}});
    int attempts = fails.is_null() ? 0 : fails.value("n", 0);
    if (!fails.is_null() && fails.contains("until")) {
        json active = findOne(db["login_fails"], {{"key", key}, {"until", {{"$gt", dateAfter(0)}}}});
        if (!active.is_null()) {
            error(res, 429, "Too many attempts. Try again later."); return;
        }
    }
    std::string lookupIdent = type == "staff" ? lower(ident) : ident;
    json user = findOne(db["users"], {{"type", type}, {"ident", lookupIdent}});
    if (user.is_null() || user.value("disabled", false) || !verifyPassword(password, user)) {
        if (attempts + 1 >= MAX_ATTEMPTS)
            update(db["login_fails"], {{"key", key}}, {{"$set", {{"n", 0}, {"until", dateAfter(LOCK_SECONDS)}}}}, true);
        else
            update(db["login_fails"], {{"key", key}}, {{"$set", {{"n", attempts + 1}}}}, true);
        error(res, 401, "Incorrect details. Please check and try again."); return;
    }
    erase(db["login_fails"], {{"key", key}});
    update(db["users"], {{"id", field(user, "id")}}, {{"$set", {{"last_login", dateAfter(0)}}}});
    setSession(res, db, field(user, "id"));
    send(res, publicUser(user));
}
} // namespace

void AuthRouter::registerRoutes(httplib::Server& server, mongocxx::database& db) {
    server.Post("/auth/citizen/otp", [&db](const httplib::Request& req, httplib::Response& res) {
        json b = body(req);
        std::string phone = trim(field(b, "phone")), password = field(b, "password"), name = trim(field(b, "name"));
        if (!validPhone(phone)) return error(res, 422, "Enter a valid 10-digit Indian mobile number.");
        if (!validPassword(password)) return error(res, 422, "Password needs at least 8 characters with a letter and a digit.");
        if (name.size() < 2) return error(res, 422, "Enter your full name.");
        if (!findOne(db["users"], {{"type", "citizen"}, {"ident", phone}}).is_null())
            return error(res, 409, "An account with this number already exists. Try signing in.");
        int number = 1000 + (std::stoi(randomHex(2).substr(0, 4), nullptr, 16) % 9000);
        std::string code = std::to_string(number);
        update(db["otps"], {{"phone", phone}}, {{"$set", {{"code", code}, {"name", name},
            {"password", password}, {"expires_at", dateAfter(OTP_TTL)}}}}, true);
        send(res, {{"demo_code", code}, {"note", "Demo only: no SMS is sent. This code would normally arrive by SMS."}});
    });

    server.Post("/auth/citizen/register", [&db](const httplib::Request& req, httplib::Response& res) {
        json b = body(req);
        std::string phone = trim(field(b, "phone")), code = trim(field(b, "code"));
        json otp = findOne(db["otps"], {{"phone", phone}});
        if (otp.is_null() || field(otp, "code") != code) return error(res, 401, "That verification code is not correct.");
        if (findOne(db["otps"], {{"phone", phone}, {"expires_at", {{"$lte", dateAfter(0)}}}}).is_null() == false)
            return error(res, 401, "That code has expired. Start again to get a new one.");
        if (!findOne(db["users"], {{"type", "citizen"}, {"ident", phone}}).is_null())
            return error(res, 409, "An account with this number already exists. Try signing in.");
        std::string salt = randomHex(16), password = field(b, "password");
        std::string id = randomToken();
        json user = {{"id", id}, {"type", "citizen"}, {"ident", phone},
            {"name", field(otp, "name")}, {"role", "Citizen"}, {"salt", salt},
            {"hash", passwordHash(password, salt, PBKDF2_ITERS)}, {"iters", PBKDF2_ITERS},
            {"disabled", false}, {"created_at", dateAfter(0)}};
        insert(db["users"], user);
        erase(db["otps"], {{"phone", phone}});
        setSession(res, db, id);
        send(res, publicUser(user));
    });

    server.Post("/auth/citizen/login", [&db](const httplib::Request& req, httplib::Response& res) {
        json b = body(req); login(res, db, "citizen", trim(field(b, "ident")), field(b, "password"));
    });
    server.Post("/auth/staff/login", [&db](const httplib::Request& req, httplib::Response& res) {
        json b = body(req); std::string email = lower(trim(field(b, "ident")));
        if (!validEmail(email)) return error(res, 422, "Enter your work email address.");
        login(res, db, "staff", email, field(b, "password"));
    });
    server.Post("/auth/staff/bootstrap", [&db](const httplib::Request& req, httplib::Response& res) {
        json b = body(req);
        if (!findOne(db["users"], {{"type", "staff"}}).is_null())
            return error(res, 409, "Staff accounts already exist — sign in instead.");
        std::string email = lower(trim(field(b, "email"))), password = field(b, "password"), name = trim(field(b, "name"));
        if (!validEmail(email)) return error(res, 422, "Enter a valid work email address.");
        if (!validPassword(password)) return error(res, 422, "Password needs at least 8 characters with a letter and a digit.");
        std::string salt = randomHex(16), id = randomToken();
        json user = {{"id", id}, {"type", "staff"}, {"ident", email}, {"name", name},
            {"role", "Admin"}, {"salt", salt}, {"hash", passwordHash(password, salt, PBKDF2_ITERS)},
            {"iters", PBKDF2_ITERS}, {"disabled", false}, {"created_at", dateAfter(0)}};
        insert(db["users"], user);
        setSession(res, db, id);
        send(res, publicUser(user));
    });
    server.Get("/auth/me", [&db](const httplib::Request& req, httplib::Response& res) {
        json user = principal(req, db);
        if (user.is_null()) { res.status = 200; res.set_content("null", "application/json"); }
        else send(res, user);
    });
    server.Post("/auth/logout", [&db](const httplib::Request& req, httplib::Response& res) {
        std::string token = cookieToken(req);
        if (!token.empty()) erase(db["sessions"], {{"token", token}});
        res.status = 204;
        res.set_header("Set-Cookie", COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    });
}

} // namespace ease::auth
