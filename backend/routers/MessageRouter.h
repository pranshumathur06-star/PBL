
#pragma once

#include "httplib.h"
#include <mongocxx/database.hpp>

namespace ease::messages {

class MessageRouter {
public:
    static void registerRoutes(httplib::Server& server,
                               mongocxx::database& database);
};

} // namespace ease::messages

