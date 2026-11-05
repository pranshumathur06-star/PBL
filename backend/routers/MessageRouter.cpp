
#include "MessageRouter.h"

#include "json.hpp"
#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <bsoncxx/types.hpp>

#include <algorithm>
#include <chrono>
#include <cctype>
#include <iomanip>
#include <random>
#include <regex>
#include <sstream>
#include <string>

namespace ease::messages {
namespace {

using json = nlohmann::json;
using bsoncxx::builder::basic::kvp;
using bsoncxx::builder::basic::make_document;

constexpr const char* kSuccessNote =
    "Saved to the project's demonstration database. No email is sent — "
    "this form does not deliver messages anywhere.";

std::string trim(const std::string& value) {
    const auto first = value.find_first_not_of(" \t\n\r\f\v");
    if (first == std::string::npos) return "";
    const auto last = value.find_last_not_of(" \t\n\r\f\v");
    return value.substr(first, last - first + 1);
}

std::string toLower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(),
                   [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    return value;
}

bool validEmail(const std::string& email) {
    static const std::regex pattern(R"(^[^@\s]+@[^@\s]+\.[^@\s]+$)");
    return std::regex_match(email, pattern);
}

std::string makeId() {
    static thread_local std::mt19937_64 generator(std::random_device{}());
    static thread_local std::uniform_int_distribution<unsigned int> byte(0, 255);

    unsigned char data[16];
    for (auto& value : data) value = static_cast<unsigned char>(byte(generator));
    data[6] = static_cast<unsigned char>((data[6] & 0x0F) | 0x40); // UUID version 4
    data[8] = static_cast<unsigned char>((data[8] & 0x3F) | 0x80); // UUID variant

    std::ostringstream output;
    output << std::hex << std::setfill('0');
    for (int i = 0; i < 16; ++i) {
        output << std::setw(2) << static_cast<unsigned int>(data[i]);
        if (i == 3 || i == 5 || i == 7 || i == 9) output << '-';
    }
    return output.str();
}

void sendError(httplib::Response& response, int status, const std::string& message) {
    response.status = status;
    response.set_content(json{{"detail", message}}.dump(), "application/json");
}

bool readRequiredString(const json& body, const char* key, std::string& value) {
    const auto it = body.find(key);
    if (it == body.end() || !it->is_string()) return false;
    value = it->get<std::string>();
    return true;
}

} // namespace

void MessageRouter::registerRoutes(httplib::Server& server,
                                   mongocxx::database& database) {
    server.Post("/api/contact", [&database](const httplib::Request& request,
                                             httplib::Response& response) {
        json body;
        try {
            body = json::parse(request.body);
        } catch (const json::parse_error&) {
            sendError(response, 422, "Request body must contain valid JSON.");
            return;
        }

        if (!body.is_object()) {
            sendError(response, 422, "Request body must be a JSON object.");
            return;
        }

        std::string name;
