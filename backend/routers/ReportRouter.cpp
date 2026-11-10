#include "ReportRouter.h"
#include "CityGraphData.h"
#include "json.hpp"

#include <bsoncxx/builder/basic/document.hpp>
#include <bsoncxx/builder/basic/kvp.hpp>
#include <bsoncxx/builder/basic/array.hpp>
#include <bsoncxx/json.hpp>
#include <mongocxx/options/find.hpp>

#include <algorithm>
#include <chrono>
#include <cctype>
#include <cmath>
#include <iomanip>
#include <optional>
#include <random>
#include <set>
#include <sstream>
#include <string>
#include <vector>

namespace ease::reports {
namespace {

using json = nlohmann::json;
using bsoncxx::builder::basic::document;
using bsoncxx::builder::basic::array;
using bsoncxx::builder::basic::kvp;
using bsoncxx::builder::basic::make_document;
using bsoncxx::types::b_date;

struct Principal {
    std::string id, type, name, phone;
};

std::string trim(const std::string& s) {
    const auto first = s.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    return s.substr(first, s.find_last_not_of(" \t\r\n") - first + 1);
}

std::string lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
        [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

std::string phoneDigits(const std::string& phone) {
    std::string result;
    for (unsigned char c : phone)
        if (std::isdigit(c)) result += static_cast<char>(c);
    if (result.size() > 10) result = result.substr(result.size() - 10);
    return result;
}

b_date nowDate() { return b_date{std::chrono::system_clock::now()}; }

std::string uuid() {
    static thread_local std::mt19937_64 rng(std::random_device{}());
    static const char* digits = "0123456789abcdef";
    std::string s;
    for (int i = 0; i < 32; ++i) s += digits[rng() % 16];
    return s.substr(0, 8) + "-" + s.substr(8, 4) + "-4" + s.substr(13, 3) +
           "-a" + s.substr(17, 3) + "-" + s.substr(20, 12);
}

std::string reportCode() {
    static thread_local std::mt19937 rng(std::random_device{}());
    static const char* digits = "0123456789ABCDEF";
    std::string code = "RPT-";
    for (int i = 0; i < 6; ++i) code += digits[rng() % 16];
    return code;
}

void error(httplib::Response& res, int status, const std::string& message) {
    res.status = status;
    res.set_content(json{{"detail", message}}.dump(), "application/json");
}

void send(httplib::Response& res, const json& data, int status = 200) {
    res.status = status;
    res.set_content(data.dump(), "application/json");
}

std::string getString(const json& j, const char* key, const std::string& fallback = "") {
    return j.contains(key) && j[key].is_string() ? j[key].get<std::string>() : fallback;
}

bool optionalString(const json& j, const char* key, std::string& value) {
    if (!j.contains(key) || j[key].is_null()) { value.clear(); return true; }
    if (!j[key].is_string()) return false;
    value = j[key].get<std::string>();
    return true;
}
