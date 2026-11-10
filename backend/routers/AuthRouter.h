#pragma once

#include "httplib.h"
#include <mongocxx/database.hpp>

namespace ease::auth {

class AuthRouter {
public:
    static void registerRoutes(httplib::Server& server,
                               mongocxx::database& database);
};

} // namespace ease::auth
