#pragma once

#include "httplib.h"
#include <mongocxx/database.hpp>

namespace ease::ops {

// Adds all Command Centre routes to the existing C++ HTTP server.
class OpsRouter {
public:
    static void registerRoutes(httplib::Server& server,
                               mongocxx::database& database);
};

} // namespace ease::ops
