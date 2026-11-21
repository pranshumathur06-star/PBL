#include "GraphRouter.h"
#include "MessageRouter.h"
#include "ReportRouter.h"
#include "OpsRouter.h"

#include <httplib.h>

#include <mongocxx/client.hpp>
#include <mongocxx/instance.hpp>
#include <mongocxx/uri.hpp>

#include <iostream>
#include <cstdlib>
#include <string>

int main() {

    // Start MongoDB
    mongocxx::instance mongoInstance{};

    const char* url = std::getenv("MONGO_URL");
    const char* name = std::getenv("DB_NAME");

    std::string mongoUrl = url ? url : "mongodb://localhost:27017";
    std::string dbName = name ? name : "ease";

    try {
        mongocxx::client client{mongocxx::uri{mongoUrl}};
        auto database = client[dbName];

        httplib::Server server;

        // Allow frontend requests
        server.set_pre_routing_handler(
            [](const httplib::Request& request,
               httplib::Response& response) {

                response.set_header(
                    "Access-Control-Allow-Origin",
                    "http://localhost:3000"
                );

                response.set_header(
                    "Access-Control-Allow-Credentials", "true"
                );

                response.set_header(
                    "Access-Control-Allow-Headers",
                    "Content-Type, Authorization"
                );

                response.set_header(
                    "Access-Control-Allow-Methods",
                    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                );

                if (request.method == "OPTIONS") {
                    response.status = 204;
                    return httplib::Server::HandlerResponse::Handled;
                }

                return httplib::Server::HandlerResponse::Unhandled;
            }
        );

        // Register all backend modules
        ease::routing::GraphRouter::registerRoutes(server);
        ease::messages::MessageRouter::registerRoutes(server, database);
        ease::reports::ReportRouter::registerRoutes(server, database);
        ease::ops::OpsRouter::registerRoutes(server, database);

        // Start server
        std::cout << "EASE Backend running on port 8080\n";

        if (!server.listen("0.0.0.0", 8080)) {
            std::cerr << "Server could not start.\n";
            return 1;
        }

    }
    catch (const std::exception& error) {
        std::cerr << "Error: " << error.what() << '\n';
        return 1;
    }

    return 0;
}
