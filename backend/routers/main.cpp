#include "GraphRouter.h"

#include <iostream>

int main() {
    httplib::Server server;
    ease::routing::GraphRouter::registerRoutes(server);

    std::cout << "EASE C++ routing API running at http://localhost:8080\n";
    std::cout << "Frontend: http://localhost:3000\n";
    if (!server.listen("0.0.0.0", 8080)) {
        std::cerr << "Could not start the routing API on port 8080.\n";
        return 1;
    }
    return 0;
}
