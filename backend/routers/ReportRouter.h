#pragma once

#include "httplib.h"
#include <mongocxx/database.hpp>

namespace ease::reports {

// Registers the citizen-facing /api/reports endpoints.
class ReportRouter {
public:
    static void registerRoutes(httplib::Server& server,
                               mongocxx::database& database);
};

} // namespace ease::reports
