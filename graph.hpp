// graph.hpp — port of backend/routers/graph.py
#pragma once

#include <crow.h>

// Python: router = APIRouter(prefix="/routing", tags=["routing"])  (mounted under /api)
// Call this once from main(), where server.py used app.include_router(...).
void register_graph_routes(crow::SimpleApp& app);
