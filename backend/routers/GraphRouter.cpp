#include "GraphRouter.h"
#include "CityGraphData.h"

#include <algorithm>
#include <chrono>
#include <functional>
#include <stdexcept>
#include <cmath>
#include <limits>
#include <queue>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace ease::routing {
namespace {
using json = nlohmann::json;
constexpr double kInfinity = std::numeric_limits<double>::infinity();

struct SearchResult {
    std::unordered_map<std::string, double> distance;
    std::unordered_map<std::string, std::string> previous;
    int settled = 0;
};

struct QueueItem {
    double distance;
    std::string node;
    bool operator>(const QueueItem& other) const {
        if (distance != other.distance) return distance > other.distance;
        return node > other.node;
    }
};

std::unordered_map<std::string, std::vector<std::pair<std::string, double>>> makeAdjacency() {
    std::unordered_map<std::string, std::vector<std::pair<std::string, double>>> graph;
    for (const auto& [id, point] : kNodes) graph[id];
    for (const auto& edge : kEdges) {
        const double km = edge.pixelLength / kPixelsPerKm;
        graph[edge.from].push_back({edge.to, km});
        graph[edge.to].push_back({edge.from, km});
    }
    return graph;
}

const auto kAdjacency = makeAdjacency();

SearchResult dijkstra(const std::string& source) {
    SearchResult result;
    for (const auto& [id, point] : kNodes) result.distance[id] = kInfinity;
    result.distance[source] = 0.0;

    std::priority_queue<QueueItem, std::vector<QueueItem>, std::greater<QueueItem>> pending;
    pending.push({0.0, source});

    while (!pending.empty()) {
        const auto current = pending.top();
        pending.pop();
        if (current.distance > result.distance[current.node]) continue;
        ++result.settled;

        for (const auto& [next, weight] : kAdjacency.at(current.node)) {
            const double candidate = current.distance + weight;
            if (candidate < result.distance[next]) {
                result.distance[next] = candidate;
                result.previous[next] = current.node;
                pending.push({candidate, next});
            }
        }
    }
    return result;
}

std::vector<std::string> buildPath(const SearchResult& search,
                                  const std::string& source,
                                  const std::string& target) {
    if (source == target) return {source};
    if (!search.previous.count(target)) return {};

    std::vector<std::string> path;
    std::string current = target;
    path.push_back(current);
    while (current != source) {
        const auto it = search.previous.find(current);
        if (it == search.previous.end()) return {};
        current = it->second;
        path.push_back(current);
    }
    std::reverse(path.begin(), path.end());
    return path;
}

std::vector<Point> buildPoints(const std::vector<std::string>& path) {
    std::vector<Point> points;
    if (path.empty()) return points;
    points.push_back(kNodes.at(path.front()));

    for (std::size_t i = 1; i < path.size(); ++i) {
        const std::string& from = path[i - 1];
        const std::string& to = path[i];
        bool found = false;
        for (const auto& edge : kEdges) {
            if (edge.from == from && edge.to == to) {
                points.insert(points.end(), edge.bends.begin(), edge.bends.end());
                found = true;
                break;
            }
            if (edge.from == to && edge.to == from) {
                points.insert(points.end(), edge.bends.rbegin(), edge.bends.rend());
                found = true;
                break;
            }
        }
        (void)found;
        points.push_back(kNodes.at(to));
    }
    return points;
}

json pointsToJson(const std::vector<Point>& points) {
    json result = json::array();
    for (const auto& p : points) result.push_back({p.x, p.y});
    return result;
}

int etaMinutes(double km) {
    return std::max(1, static_cast<int>(std::lround((km / 21.0) * 60.0)));
}

double roundedKm(double km) { return std::round(km * 100.0) / 100.0; }

std::string helplineFor(const std::string& type) {
    if (type == "hospital") return "108";
    if (type == "fire") return "101";
    if (type == "police") return "100";
    return "112";
}

bool readDouble(const httplib::Request& req, const char* key, double& value) {
    if (!req.has_param(key)) return false;
    try {
        const std::string raw = req.get_param_value(key);
        std::size_t used = 0;
        value = std::stod(raw, &used);
        return used == raw.size() && std::isfinite(value);
    } catch (...) {
        return false;
    }
}

std::string snap(double x, double y) {
    std::string closest;
    double best = kInfinity;
    for (const auto& [id, point] : kNodes) {
        const double dx = point.x - x;
        const double dy = point.y - y;
        const double distance = dx * dx + dy * dy;
        if (distance < best) {
            best = distance;
            closest = id;
        }
    }
    return closest;
}

json makeRouteResponse(const std::string& source, const std::string& target,
                       const SearchResult& search, double computeMs) {
    const auto path = buildPath(search, source, target);
    if (path.empty()) return json();
    const double km = search.distance.at(target);
    return {
        {"from_node", source}, {"to_node", target},
        {"distance_km", roundedKm(km)}, {"eta_min", etaMinutes(km)},
        {"path", path}, {"points", pointsToJson(buildPoints(path))},
        {"settled", search.settled}, {"compute_ms", computeMs}
    };
}

void notFound(httplib::Response& response, const std::string& message) {
    response.status = 404;
    response.set_content(json{{"detail", message}}.dump(), "application/json");
}

void badRequest(httplib::Response& response, const std::string& message) {
    response.status = 422;
    response.set_content(json{{"detail", message}}.dump(), "application/json");
}
} 

void GraphRouter::registerRoutes(httplib::Server& server) {
    
    server.Get("/api/routing/graph", [](const httplib::Request&, httplib::Response& response) {
        json nodes = json::object();
        for (const auto& [id, p] : kNodes) nodes[id] = {p.x, p.y};

        json edges = json::array();
        for (const auto& edge : kEdges) {
            json bends = json::array();
            for (const auto& p : edge.bends) bends.push_back({p.x, p.y});
            edges.push_back({std::stoi(edge.from), std::stoi(edge.to), edge.pixelLength, bends});
        }

        json facilities = json::array();
        for (const auto& f : kFacilities) {
            facilities.push_back({{"n", f.name}, {"t", f.type},
                                  {"p", {f.position.x, f.position.y}}, {"at", f.node}});
        }

        response.set_content(json{
            {"pxkm", kPixelsPerKm}, {"nodes", nodes}, {"edges", edges},
            {"facilities", facilities}, {"center_node", kCenterNode},
            {"node_count", kNodes.size()}, {"edge_count", kEdges.size()}
        }.dump(), "application/json");
    });

    // GET /api/routing/nearby?node=1&types=hospital,police,fire&limit=3
    server.Get("/api/routing/nearby", [](const httplib::Request& request, httplib::Response& response) {
        if (!request.has_param("node")) {
            badRequest(response, "Missing required query parameter: node");
            return;
        }
        const std::string source = request.get_param_value("node");
        if (!kNodes.count(source)) {
            notFound(response, "Unknown node on the sample graph.");
            return;
        }

        int limit = 3;
        if (request.has_param("limit")) {
            try {
                const std::string raw = request.get_param_value("limit");
                std::size_t used = 0;
                limit = std::stoi(raw, &used);
                if (used != raw.size() || limit < 1 || limit > 10) throw std::invalid_argument("limit");
            } catch (...) {
                badRequest(response, "limit must be an integer between 1 and 10");
                return;
            }
        }

        std::string types = request.has_param("types")
            ? request.get_param_value("types") : "hospital,police,fire";
        std::vector<std::string> wanted;
        std::size_t start = 0;
        while (start <= types.size()) {
            const auto comma = types.find(',', start);
            std::string type = types.substr(start, comma == std::string::npos ? comma : comma - start);
            const auto first = type.find_first_not_of(" \t\r\n");
            const auto last = type.find_last_not_of(" \t\r\n");
            if (first != std::string::npos) wanted.push_back(type.substr(first, last - first + 1));
            if (comma == std::string::npos) break;
            start = comma + 1;
        }

        const auto search = dijkstra(source); // One Dijkstra run for all requested types.
        json output = json::array();
        for (const auto& type : wanted) {
            std::vector<const Facility*> ranked;
            for (const auto& facility : kFacilities) {
                if (facility.type == type && search.distance.at(facility.node) != kInfinity)
                    ranked.push_back(&facility);
            }
            std::stable_sort(ranked.begin(), ranked.end(), [&](const Facility* a, const Facility* b) {
                return search.distance.at(a->node) < search.distance.at(b->node);
            });

            const std::size_t count = std::min<std::size_t>(ranked.size(), static_cast<std::size_t>(limit));
            for (std::size_t i = 0; i < count; ++i) {
                const Facility& f = *ranked[i];
                const auto path = buildPath(search, source, f.node);
                auto points = buildPoints(path);
                std::reverse(points.begin(), points.end()); // Facility to incident, as expected by the map.
                const double km = search.distance.at(f.node);
                output.push_back({
                    {"name", f.name}, {"type", type}, {"node", f.node},
                    {"distance_km", roundedKm(km)}, {"eta_min", etaMinutes(km)},
                    {"helpline", helplineFor(type)}, {"points", pointsToJson(points)}
                });
            }
        }
        response.set_content(output.dump(), "application/json");
    });

    
    server.Get("/api/routing/route", [](const httplib::Request& request, httplib::Response& response) {
        double fromX, fromY, toX, toY;
        if (!readDouble(request, "from_x", fromX) || !readDouble(request, "from_y", fromY) ||
            !readDouble(request, "to_x", toX) || !readDouble(request, "to_y", toY)) {
            badRequest(response, "from_x, from_y, to_x and to_y must be valid numbers");
            return;
        }
        const std::string source = snap(fromX, fromY);
        const std::string target = snap(toX, toY);
        const auto start = std::chrono::steady_clock::now();
        const auto search = dijkstra(source);
        const auto end = std::chrono::steady_clock::now();
        const double ms = std::chrono::duration<double, std::milli>(end - start).count();
        const json result = makeRouteResponse(source, target, search, ms);
        if (result.is_null()) {
            notFound(response, "No road path between those points on the sample graph.");
            return;
        }
        response.set_content(result.dump(), "application/json");
    });

   
    server.Get("/api/routing/route/nodes", [](const httplib::Request& request, httplib::Response& response) {
        if (!request.has_param("from_node") || !request.has_param("to_node")) {
            badRequest(response, "from_node and to_node are required");
            return;
        }
        const std::string source = request.get_param_value("from_node");
        const std::string target = request.get_param_value("to_node");
        if (!kNodes.count(source) || !kNodes.count(target)) {
            notFound(response, "Unknown node on the sample graph.");
            return;
        }
        const auto start = std::chrono::steady_clock::now();
        const auto search = dijkstra(source);
        const auto end = std::chrono::steady_clock::now();
        const double ms = std::chrono::duration<double, std::milli>(end - start).count();
        const json result = makeRouteResponse(source, target, search, ms);
        if (result.is_null()) {
            notFound(response, "No road path between those nodes.");
            return;
        }
        response.set_content(result.dump(), "application/json");
    });
}

} 
