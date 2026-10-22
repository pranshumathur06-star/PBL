// auth.cpp — port of backend/routers/auth.py
//
// Auth routes — citizen (mobile + demo OTP), staff (email + roles), first-admin bootstrap.
//
// Migration note: the original stored PBKDF2 hashes and sessions in the browser
// (localStorage/sessionStorage) and honestly labelled that as NOT a security boundary.
// Sessions are now httpOnly cookies backed by Mongo; passwords hashed server-side with the
// same PBKDF2-SHA256 / 120k iterations. The 5-attempt lockout is preserved.
//
// ---------------------------------------------------------------------------
// This file expects the C++ ports of the modules it imported in Python.
// Names are the same as in the Python code:
//
//   ../lib/db.hpp        extern Database db;
//                        db.users / db.otps / db.login_fails, each with the Motor-style calls
//                          std::optional<json> find_one(const json& filter);
//                          void update_one(const json& filter, const json& update, bool upsert = false);
//                          void insert_one(const json& doc);
//                          void delete_one(const json& filter);
//                        plus an nlohmann adl_serializer<TimePoint> so datetimes can live in json
//
//   ../lib/security.hpp  using TimePoint = std::chrono::system_clock::time_point;
//                        constexpr int PBKDF2_ITERS = 120000;
//                        extern const std::string SESSION_COOKIE;
//                        TimePoint utcnow();
//                        void create_session(crow::response& response, const std::string& user_id);
//                        void destroy_session(const crow::request& request);
//                        std::optional<Principal> get_principal(const crow::request& request);
//                        std::tuple<std::string, std::string, int> hash_password(const std::string& password);
//                        bool verify_password(const std::string& password, const std::string& salt,
//                                             const std::string& hash, int iters);
//                        struct Principal { std::string user_id, type, name, role, ident; };
//
//   ../models/ease.hpp   structs (fields in this order, with nlohmann to_json/from_json):
//                          BootstrapBody    { name, email, password }
//                          CitizenOtpVerify { phone, code, password, name }
//                          LoginBody        { ident, password }
//                          OtpIssue         { phone, password, name }
//                          SessionUser      { id, type, name, role, ident }
// ---------------------------------------------------------------------------

#include "auth.hpp"

#include <algorithm>
#include <chrono>
#include <optional>
#include <regex>
#include <string>
#include <tuple>

#include "../lib/db.hpp"
#include "../lib/security.hpp"
#include "../models/ease.hpp"
#include "pyshim.hpp"

// router = APIRouter(prefix="/auth", tags=["auth"])  -> the "/api/auth" prefix is written into each route below

static const std::regex MOBILE_RE(R"(^[6-9]\d{9}$)");
static const std::regex EMAIL_RE(R"(^[^@\s]+@[^@\s]+\.[^@\s]+$)");
constexpr int OTP_TTL_SECONDS = 600;
constexpr int LOCK_SECONDS = 300;
constexpr int MAX_ATTEMPTS = 5;

SessionUser public_user(const json& u) {
    return SessionUser{u.at("id").get<std::string>(), u.at("type").get<std::string>(),
                       u.at("name").get<std::string>(), u.value("role", std::string("Citizen")),
                       u.at("ident").get<std::string>()};
}

// NOTE: the letter/digit checks are ASCII-only here; Python's isalpha()/isdigit() also accept
// letters and digits from other scripts.
bool pw_ok(const std::string& p) {
    return py_len(p) >= 8
        && std::any_of(p.begin(), p.end(), [](unsigned char c) { return std::isalpha(c) != 0; })
        && std::any_of(p.begin(), p.end(), [](unsigned char c) { return std::isdigit(c) != 0; });
}

int lock_state(const std::string& key) {
    std::optional<json> rec = db.login_fails.find_one({{"key", key}});
    if (rec && rec->contains("until") && !rec->at("until").is_null()
        && rec->at("until").get<TimePoint>() >= utcnow()) {
        auto secs = std::chrono::duration_cast<std::chrono::seconds>(
                        rec->at("until").get<TimePoint>() - utcnow()).count();
        throw HTTPException{429, "Too many attempts. Try again in "
                                     + std::to_string(std::max<long long>(secs, 1)) + " s."};
    }
    return rec ? rec->at("n").get<int>() : 0;
}

void register_fail(const std::string& key, int n) {
    if (n + 1 >= MAX_ATTEMPTS) {
        db.login_fails.update_one(
            {{"key", key}},
            {{"$set", {{"n", 0}, {"until", utcnow() + std::chrono::seconds(LOCK_SECONDS)}}}},
            true);
    } else {
        db.login_fails.update_one({{"key", key}}, {{"$set", {{"n", n + 1}}}}, true);
    }
}

SessionUser do_login(crow::response& response, const std::string& user_type, std::string ident,
                     const std::string& password) {
    ident = strip(ident);
    std::string key = user_type + ":" + to_lower(ident);
    int n = lock_state(key);
    std::optional<json> user = db.users.find_one(
        {{"type", user_type}, {"ident", user_type == "staff" ? to_lower(ident) : ident}});
    if (!user || user->value("disabled", false)
        || !verify_password(password, user->value("salt", std::string()),
                            user->value("hash", std::string()), user->value("iters", PBKDF2_ITERS))) {
        register_fail(key, n);
        throw HTTPException{401, "Incorrect details. Please check and try again."};
    }
    db.login_fails.delete_one({{"key", key}});
    db.users.update_one({{"id", user->at("id")}}, {{"$set", {{"last_login", utcnow()}}}});
    create_session(response, user->at("id").get<std::string>());
    return public_user(*user);
}

// @router.post("/citizen/otp")
// Step 1 of citizen registration. Demo honesty: there is no SMS gateway, so the
// verification code is returned here and shown in the UI labelled as demo-only.
json citizen_otp(const OtpIssue& body) {
    std::string phone = strip(body.phone);
    if (!std::regex_match(phone, MOBILE_RE))
        throw HTTPException{422, "Enter a valid 10-digit Indian mobile number."};
    if (!pw_ok(body.password))
        throw HTTPException{422, "Password needs at least 8 characters with a letter and a digit."};
    if (py_len(strip(body.name)) < 2)
        throw HTTPException{422, "Enter your full name."};
    if (db.users.find_one({{"type", "citizen"}, {"ident", phone}}))
        throw HTTPException{409, "An account with this number already exists. Try signing in."};
    std::string code = std::to_string(secrets::randbelow(9000) + 1000);
    db.otps.update_one(
        {{"phone", phone}},
        {{"$set", {{"code", code},
                   {"name", strip(body.name)},
                   {"password", body.password},
                   {"expires_at", utcnow() + std::chrono::seconds(OTP_TTL_SECONDS)}}}},
        true);
    return json{{"demo_code", code},
                {"note", "Demo only: no SMS is sent. This code would normally arrive by SMS."}};
}

// @router.post("/citizen/register", response_model=SessionUser)
SessionUser citizen_register(const CitizenOtpVerify& body, crow::response& response) {
    std::string phone = strip(body.phone);
    std::optional<json> rec = db.otps.find_one({{"phone", phone}});
    if (!rec || !rec->contains("code") || rec->at("code").get<std::string>() != strip(body.code))
        throw HTTPException{401, "That verification code is not correct."};
    if (rec->at("expires_at").get<TimePoint>() < utcnow())
        throw HTTPException{401, "That code has expired. Start again to get a new one."};
    if (db.users.find_one({{"type", "citizen"}, {"ident", phone}}))
        throw HTTPException{409, "An account with this number already exists. Try signing in."};
    auto [salt, digest, iters] = hash_password(body.password);
    json user = {{"id", secrets::token_urlsafe(12)}, {"type", "citizen"}, {"ident", phone},
                 {"name", rec->value("name", strip(body.name))},
                 {"role", "Citizen"}, {"salt", salt}, {"hash", digest}, {"iters", iters},
                 {"disabled", false}, {"created_at", utcnow()}};
    db.users.insert_one(user);
    db.otps.delete_one({{"phone", phone}});
    create_session(response, user.at("id").get<std::string>());
    return public_user(user);
}

// @router.post("/citizen/login", response_model=SessionUser)
SessionUser citizen_login(const LoginBody& body, crow::response& response) {
    return do_login(response, "citizen", strip(body.ident), body.password);
}

// @router.post("/staff/login", response_model=SessionUser)
SessionUser staff_login(const LoginBody& body, crow::response& response) {
    std::string ident = to_lower(strip(body.ident));
    if (!std::regex_match(ident, EMAIL_RE))
        throw HTTPException{422, "Enter your work email address."};
    return do_login(response, "staff", ident, body.password);
}

// @router.post("/staff/bootstrap", response_model=SessionUser)
// First-run setup: when no staff account exists, the first account becomes Admin
// (preserved from the original). Disabled once any staff account exists.
SessionUser staff_bootstrap(const BootstrapBody& body, crow::response& response) {
    if (db.users.find_one({{"type", "staff"}}))
        throw HTTPException{409, "Staff accounts already exist \xE2\x80\x94 sign in instead."};
    std::string email = to_lower(strip(body.email));
    if (!std::regex_match(email, EMAIL_RE))
        throw HTTPException{422, "Enter a valid work email address."};
    if (!pw_ok(body.password))
        throw HTTPException{422, "Password needs at least 8 characters with a letter and a digit."};
    auto [salt, digest, iters] = hash_password(body.password);
    json user = {{"id", secrets::token_urlsafe(12)}, {"type", "staff"}, {"ident", email},
                 {"name", strip(body.name)},
                 {"role", "Admin"}, {"salt", salt}, {"hash", digest}, {"iters", iters},
                 {"disabled", false}, {"created_at", utcnow()}};
    db.users.insert_one(user);
    create_session(response, user.at("id").get<std::string>());
    return public_user(user);
}

// @router.get("/me", response_model=SessionUser | None)
std::optional<SessionUser> me(const std::optional<Principal>& principal) {
    if (!principal) return std::nullopt;
    return SessionUser{principal->user_id, principal->type, principal->name, principal->role,
                       principal->ident};
}

// @router.post("/logout", status_code=204)
void logout(const crow::request& request, crow::response& response) {
    destroy_session(request);
    delete_cookie(response, SESSION_COOKIE, "/");
}

// ---------------------------------------------------------------------------
// Route wiring (what the @router.* decorators did in FastAPI)
// ---------------------------------------------------------------------------
void register_auth_routes(crow::SimpleApp& app) {
    CROW_ROUTE(app, "/api/auth/citizen/otp").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            OtpIssue body = parse_body<OtpIssue>(req);
            crow::response response;
            set_json(response, 200, citizen_otp(body));
            return response;
        });
    });

    CROW_ROUTE(app, "/api/auth/citizen/register").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            CitizenOtpVerify body = parse_body<CitizenOtpVerify>(req);
            crow::response response;
            set_json(response, 200, json(citizen_register(body, response)));
            return response;
        });
    });

    CROW_ROUTE(app, "/api/auth/citizen/login").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            LoginBody body = parse_body<LoginBody>(req);
            crow::response response;
            set_json(response, 200, json(citizen_login(body, response)));
            return response;
        });
    });

    CROW_ROUTE(app, "/api/auth/staff/login").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            LoginBody body = parse_body<LoginBody>(req);
            crow::response response;
            set_json(response, 200, json(staff_login(body, response)));
            return response;
        });
    });

    CROW_ROUTE(app, "/api/auth/staff/bootstrap").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            BootstrapBody body = parse_body<BootstrapBody>(req);
            crow::response response;
            set_json(response, 200, json(staff_bootstrap(body, response)));
            return response;
        });
    });

    CROW_ROUTE(app, "/api/auth/me").methods(crow::HTTPMethod::GET)
    ([](const crow::request& req) {
        return handle([&]() {
            std::optional<Principal> principal = get_principal(req);
            std::optional<SessionUser> result = me(principal);
            crow::response response;
            set_json(response, 200, result ? json(*result) : json(nullptr));
            return response;
        });
    });

    CROW_ROUTE(app, "/api/auth/logout").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            crow::response response;
            response.code = 204;
            logout(req, response);
            return response;
        });
    });
}
