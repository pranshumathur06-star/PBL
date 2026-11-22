#include "AuthRouter.h"
#include "GraphRouter.h"
#include "MessageRouter.h"
#include "ReportRouter.h"
#include "OpsRouter.h"

#include <httplib.h>
#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

namespace {

// Read backend/.env without requiring an extra library.
void loadEnv(const std::string& path) {
    std::ifstream file(path);
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') continue;
        const auto equal = line.find('=');
        if (equal == std::string::npos) continue;

        std::string key = line.substr(0, equal);
        std::string value = line.substr(equal + 1);
        while (!key.empty() && (key.back() == ' ' || key.back() == '\t')) key.pop_back();
        while (!value.empty() && (value.front() == ' ' || value.front() == '\t')) value.erase(0, 1);
        if (value.size() >= 2 &&
            ((value.front() == '"' && value.back() == '"') ||
             (value.front() == '\'' && value.back() == '\''))) {
            value = value.substr(1, value.size() - 2);
        }
        if (!key.empty() && std::getenv(key.c_str()) == nullptr) {
#ifdef _WIN32
            _putenv_s(key.c_str(), value.c_str());
#else
            setenv(key.c_str(), value.c_str(), 0);
#endif
        }
    }
}

} // namespace

int main() {
    loadEnv(".env");

    mongocxx::instance mongoInstance{};
    const char* url = std::getenv("MONGO_URL");
    const char* name = std::getenv("DB_NAME");
    const char* portValue = std::getenv("PORT");
    const char* corsValue = std::getenv("CORS_ORIGINS");

    const std::string mongoUrl = url ? url : "mongodb://localhost:27017";
    const std::string dbName = name ? name : "ease";
    const int port = portValue ? std::stoi(portValue) : 8001;
    const std::string corsOrigin = corsValue ? corsValue : "http://localhost:3000";

    try {
        mongocxx::client client{mongocxx::uri{mongoUrl}};
        auto database = client[dbName];
        httplib::Server server;

        server.set_pre_routing_handler(
            [&corsOrigin](const httplib::Request& request,
                          httplib::Response& response) {
                response.set_header("Access-Control-Allow-Origin", corsOrigin);
                response.set_header("Access-Control-Allow-Credentials", "true");
                response.set_header("Access-Control-Allow-Headers",
                                    "Content-Type, Authorization");
                response.set_header("Access-Control-Allow-Methods",
                                    "GET, POST, PUT, PATCH, DELETE, OPTIONS");
                if (request.method == "OPTIONS") {
                    response.status = 204;
                    return httplib::Server::HandlerResponse::Handled;
                }
                return httplib::Server::HandlerResponse::Unhandled;
            }
        );

        // All routes are mounted under /api, matching the existing Vite proxy.
        ease::auth::AuthRouter::registerRoutes(server, database);
        ease::routing::GraphRouter::registerRoutes(server);
        ease::messages::MessageRouter::registerRoutes(server, database);
        ease::reports::ReportRouter::registerRoutes(server, database);
        ease::ops::OpsRouter::registerRoutes(server, database);

        std::cout << "EASE C++ backend running on port " << port << '\n';
        if (!server.listen("0.0.0.0", port)) {
            std::cerr << "Could not start HTTP server on port " << port << '\n';
            return 1;
        }
    }
    catch (const std::exception& error) {
        std::cerr << "Backend error: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
