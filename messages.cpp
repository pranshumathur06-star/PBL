// messages.cpp — port of backend/routers/messages.py
//
// Contact / demo-request endpoint. Stores the message and is honest about it:
// no email is sent — nothing pretends to be delivered.
//
// ---------------------------------------------------------------------------
// Expected from the other ports (same names as the Python modules):
//
//   ../lib/db.hpp        extern Database db;  db.messages.insert_one(const json& doc);
//   ../lib/security.hpp  TimePoint utcnow();
//   ../models/ease.hpp   ContactMessage { email, id, ... } with nlohmann to_json / from_json
//                        (to_json is Pydantic's model_dump())
// ---------------------------------------------------------------------------

#include "messages.hpp"

#include <regex>
#include <string>

#include "../lib/db.hpp"
#include "../lib/security.hpp"
#include "../models/ease.hpp"
#include "pyshim.hpp"

// router = APIRouter(prefix="/contact", tags=["contact"])  -> "/api/contact" is written into the route below

static const std::regex EMAIL_RE(R"(^[^@\s]+@[^@\s]+\.[^@\s]+$)");

// @router.post("", status_code=201)
json submit(const ContactMessage& body) {
    if (!std::regex_match(strip(body.email), EMAIL_RE))
        throw HTTPException{422, "Enter a valid email address."};
    json doc = body;                                  // body.model_dump()
    doc["email"] = to_lower(strip(body.email));
    doc["created_at"] = utcnow();
    db.messages.insert_one(doc);
    return json{{"ok", true}, {"id", body.id},
                {"note", "Saved to the project's demonstration database. No email is sent \xE2\x80\x94 "
                         "this form does not deliver messages anywhere."}};
}

void register_messages_routes(crow::SimpleApp& app) {
    CROW_ROUTE(app, "/api/contact").methods(crow::HTTPMethod::POST)
    ([](const crow::request& req) {
        return handle([&]() {
            ContactMessage body = parse_body<ContactMessage>(req);
            return json_ok(submit(body), 201);
        });
    });
}
