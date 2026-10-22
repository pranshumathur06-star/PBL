// pyshim.hpp — small stand-ins for the Python / FastAPI built-ins the routers rely on.
// Every router (auth, graph, messages, ops, reports) can include this one header.
//
// Needs: Crow (https://crowcpp.org) and nlohmann/json, C++17.
#pragma once

#include <crow.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <optional>
#include <random>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>

using json = nlohmann::json;

// ---- fastapi.HTTPException -------------------------------------------------
struct HTTPException {
    int status_code;
    std::string detail;
};

// Runs a route body and turns a thrown HTTPException into FastAPI's
// {"detail": "..."} error response.
inline void set_json(crow::response& response, int code, const json& body) {
    response.code = code;
    response.body = body.dump();
    response.set_header("Content-Type", "application/json");
}

template <typename F>
crow::response handle(F&& fn) {
    try {
        return fn();
    } catch (const HTTPException& e) {
        crow::response response;
        set_json(response, e.status_code, json{{"detail", e.detail}});
        return response;
    }
}

// Pydantic body parsing: a malformed / incomplete body gives 422, like FastAPI.
template <typename T>
T parse_body(const crow::request& req) {
    try {
        return json::parse(req.body).get<T>();
    } catch (const json::exception&) {
        throw HTTPException{422, "Invalid request body."};
    }
}

// ---- Response.delete_cookie(key=..., path=...) ------------------------------
inline void delete_cookie(crow::response& response, const std::string& key, const std::string& path = "/") {
    response.add_header(
        "Set-Cookie",
        key + "=\"\"; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=" + path + "; SameSite=lax");
}

// ---- str helpers ------------------------------------------------------------
// str.strip()
inline std::string strip(const std::string& s) {
    std::size_t b = 0, e = s.size();
    while (b < e && std::isspace(static_cast<unsigned char>(s[b]))) ++b;
    while (e > b && std::isspace(static_cast<unsigned char>(s[e - 1]))) --e;
    return s.substr(b, e - b);
}

// str.lower() (ASCII)
inline std::string to_lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

// len(str): counts characters (code points), not bytes, so Hindi names and
// passwords are measured the same way Python measures them.
inline std::size_t py_len(const std::string& s) {
    std::size_t n = 0;
    for (unsigned char c : s)
        if ((c & 0xC0) != 0x80) ++n;
    return n;
}

// ---- the `secrets` module ---------------------------------------------------
namespace secrets {

// secrets.randbelow(n): uniform integer in [0, n)
inline int randbelow(int n) {
    static thread_local std::random_device rd;
    std::uniform_int_distribution<int> dist(0, n - 1);
    return dist(rd);
}

// secrets.token_urlsafe(nbytes): URL-safe base64 of random bytes, no padding
inline std::string token_urlsafe(int nbytes = 32) {
    static const char* B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    static thread_local std::random_device rd;
    std::string out;
    std::uint32_t buf = 0;
    int bits = 0;
    for (int i = 0; i < nbytes; ++i) {
        buf = (buf << 8) | (rd() & 0xFFu);
        bits += 8;
        while (bits >= 6) {
            bits -= 6;
            out.push_back(B64[(buf >> bits) & 0x3Fu]);
        }
    }
    if (bits > 0) out.push_back(B64[(buf << (6 - bits)) & 0x3Fu]);
    return out;
}

// secrets.token_hex(nbytes): random bytes as lowercase hex (call .upper() -> to_upper)
inline std::string token_hex(int nbytes = 32) {
    static const char* HEX = "0123456789abcdef";
    static thread_local std::random_device rd;
    std::string out;
    for (int i = 0; i < nbytes; ++i) {
        unsigned b = rd() & 0xFFu;
        out.push_back(HEX[b >> 4]);
        out.push_back(HEX[b & 0xF]);
    }
    return out;
}

}  // namespace secrets

// str.upper() (ASCII)
inline std::string to_upper(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::toupper(c)); });
    return s;
}

// str.split(sep)
inline std::vector<std::string> split(const std::string& s, const std::string& sep) {
    std::vector<std::string> out;
    std::size_t start = 0, pos;
    while ((pos = s.find(sep, start)) != std::string::npos) {
        out.push_back(s.substr(start, pos - start));
        start = pos + sep.size();
    }
    out.push_back(s.substr(start));
    return out;
}

// str.split() with no argument: split on runs of whitespace, drop empties
inline std::vector<std::string> split_ws(const std::string& s) {
    std::vector<std::string> out;
    std::size_t i = 0, n = s.size();
    while (i < n) {
        while (i < n && std::isspace(static_cast<unsigned char>(s[i]))) ++i;
        std::size_t j = i;
        while (j < n && !std::isspace(static_cast<unsigned char>(s[j]))) ++j;
        if (j > i) out.push_back(s.substr(i, j - i));
        i = j;
    }
    return out;
}

// re.escape(s) (Python 3.7+ rules: only characters with a special meaning)
inline std::string re_escape(const std::string& s) {
    static const std::string special = "()[]{}?*+-|^$\\.&~# \t\n\r\v\f";
    std::string out;
    for (char c : s) {
        if (special.find(c) != std::string::npos) out.push_back('\\');
        out.push_back(c);
    }
    return out;
}

// f"{x:.{digits}f}"
inline std::string fmt_fixed(double x, int digits) {
    char buf[512];
    std::snprintf(buf, sizeof buf, "%.*f", digits, x);
    return buf;
}

// round(x, digits): printf rounds the exact binary value, like Python does
inline double py_round(double x, int digits) {
    return std::strtod(fmt_fixed(x, digits).c_str(), nullptr);
}

// s[:n], counted in characters (code points) so a Hindi note is never cut mid-character
inline std::string py_prefix(const std::string& s, std::size_t n) {
    std::size_t chars = 0, i = 0;
    for (; i < s.size(); ++i) {
        if ((static_cast<unsigned char>(s[i]) & 0xC0) != 0x80) {
            if (chars == n) break;
            ++chars;
        }
    }
    return s.substr(0, i);
}

// `a or b` for an optional string (None and "" are both falsy)
inline std::string py_or(const std::optional<std::string>& a, const std::string& b) {
    return (a && !a->empty()) ? *a : b;
}

// str(True) / str(False)
inline std::string py_bool(bool b) { return b ? "True" : "False"; }

// ---- json / Crow helpers ------------------------------------------------------

// Returns `value` as a JSON response (FastAPI response_model + status_code)
template <typename R>
crow::response json_ok(const R& value, int code = 200) {
    crow::response response;
    set_json(response, code, json(value));
    return response;
}

// `body: Model | None = None`
template <typename T>
std::optional<T> parse_optional_body(const crow::request& req) {
    std::string raw = strip(req.body);
    if (raw.empty() || raw == "null") return std::nullopt;
    return parse_body<T>(req);
}

// Query(...) helpers. Missing / malformed values give 422, like FastAPI.
inline std::string query_or(const crow::request& req, const std::string& name,
                            const std::string& default_value = "") {
    const char* v = req.url_params.get(name);
    return v ? std::string(v) : default_value;
}

inline std::string required_query(const crow::request& req, const std::string& name) {
    const char* v = req.url_params.get(name);
    if (!v) throw HTTPException{422, "Field required: " + name};
    return v;
}

inline double required_query_double(const crow::request& req, const std::string& name) {
    std::string s = required_query(req, name);
    try {
        std::size_t pos = 0;
        double d = std::stod(s, &pos);
        if (pos != s.size()) throw std::invalid_argument("trailing characters");
        return d;
    } catch (const std::logic_error&) {
        throw HTTPException{422, "Input should be a valid number: " + name};
    }
}

// Query(default, ge=..., le=...)
inline int query_int(const crow::request& req, const std::string& name, int default_value, int ge, int le) {
    const char* v = req.url_params.get(name);
    if (!v) return default_value;
    try {
        std::size_t pos = 0;
        int n = std::stoi(v, &pos);
        if (pos != std::strlen(v) || n < ge || n > le) throw std::out_of_range("range");
        return n;
    } catch (const std::logic_error&) {
        throw HTTPException{422, "Query parameter '" + name + "' must be an integer between " +
                                     std::to_string(ge) + " and " + std::to_string(le) + "."};
    }
}

// doc["key"] as a string (throws if missing, like a Python KeyError)
inline std::string str_at(const json& d, const std::string& key) { return d.at(key).get<std::string>(); }

// doc.get("key") for a string field; stored None (json null) and a missing key both give nullopt
inline std::optional<std::string> get_opt_str(const json& d, const std::string& key) {
    auto it = d.find(key);
    if (it == d.end() || it->is_null()) return std::nullopt;
    return it->get<std::string>();
}

// doc.get("key", default) for a string field
inline std::string get_str(const json& d, const std::string& key, const std::string& default_value = "") {
    return get_opt_str(d, key).value_or(default_value);
}

// doc.get("key", default) used as a truth value (a stored None is falsy)
inline bool get_bool(const json& d, const std::string& key, bool default_value) {
    auto it = d.find(key);
    if (it == d.end()) return default_value;
    return it->is_null() ? false : it->get<bool>();
}

// str(value) for the scalar values that end up in audit text: None / True / False / text / numbers
inline std::string py_str(const json& v) {
    if (v.is_null()) return "None";
    if (v.is_boolean()) return py_bool(v.get<bool>());
    if (v.is_string()) return v.get<std::string>();
    return v.dump();
}

// f"{doc.get(key)}"
inline std::string py_str_get(const json& d, const std::string& key) {
    auto it = d.find(key);
    return it == d.end() ? std::string("None") : py_str(*it);
}
