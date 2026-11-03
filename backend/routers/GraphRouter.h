#pragma once

#include "httplib.h"
#include "json.hpp"

namespace ease::routing {

// Registers the same public endpoints previously provided by routers/graph.py.
class GraphRouter {
public:
    static void registerRoutes(httplib::Server& server);
};

} // namespace ease::routing
