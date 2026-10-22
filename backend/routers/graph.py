"""Public routing-graph endpoints: Dehradun demonstration graph + Dijkstra routes."""

from fastapi import APIRouter, HTTPException, Query

from lib.routing import CENTER_NODE, dijkstra, eta_min, facilities, path_points, route, snap
from lib.city_graph import CITY, PXKM
from models.ease import NearbyFacility, RouteResult

router = APIRouter(prefix="/routing", tags=["routing"])

# National helplines in India by facility type (112 is the single emergency number).
HELPLINE = {"hospital": "108", "fire": "101", "police": "100", "pharmacy": "112", "mech": "112"}


@router.get("/nearby", response_model=list[NearbyFacility])
async def nearby(node: str = Query(...), types: str = Query("hospital,police,fire"), limit: int = Query(3, ge=1, le=10)):
    """Facilities ranked by true shortest-path distance from `node` on the sample graph.
    One Dijkstra run, then per-type top-N. Sample data — not a live facility directory."""
    if node not in CITY["nodes"]:
        raise HTTPException(status_code=404, detail="Unknown node on the sample graph.")
    wanted = [t.strip() for t in types.split(",") if t.strip()]
    dist, prev, _settled = dijkstra(node)
    out: list[NearbyFacility] = []
    for t in wanted:
        ranked = sorted(
            (f for f in facilities() if f["t"] == t and dist.get(f["at"], float("inf")) != float("inf")),
            key=lambda f: dist[f["at"]],
        )[:limit]
        for f in ranked:
            _path, pts = path_points(prev, node, f["at"])
            out.append(NearbyFacility(
                name=f["n"], type=t, node=f["at"], distance_km=round(dist[f["at"]], 2),
                eta_min=eta_min(dist[f["at"]]), helpline=HELPLINE.get(t, "112"),
                points=list(reversed(pts)),  # facility → incident, for drawing
            ))
    return out


@router.get("/graph")
async def get_graph():
    """The sample road graph used by every map visualisation. Illustrative geometry —
    not a navigation-grade map; © OpenStreetMap contributors for the original basemap idea."""
    return {
        "pxkm": PXKM,
        "nodes": CITY["nodes"],
        "edges": CITY["edges"],
        "facilities": facilities(),
        "center_node": CENTER_NODE,
        "node_count": len(CITY["nodes"]),
        "edge_count": len(CITY["edges"]),
    }


@router.get("/route", response_model=RouteResult)
async def get_route(
    from_x: float = Query(...), from_y: float = Query(...),
    to_x: float = Query(...), to_y: float = Query(...),
):
    src, dst = snap(from_x, from_y), snap(to_x, to_y)
    km, path, pts, settled, ms = route(src, dst)
    if not path:
        raise HTTPException(status_code=404, detail="No road path between those points on the sample graph.")
    return RouteResult(
        from_node=src, to_node=dst, distance_km=round(km, 2), eta_min=eta_min(km),
        path=path, points=pts, settled=settled, compute_ms=ms,
    )


@router.get("/route/nodes", response_model=RouteResult)
async def get_route_nodes(from_node: str = Query(...), to_node: str = Query(...)):
    if from_node not in CITY["nodes"] or to_node not in CITY["nodes"]:
        raise HTTPException(status_code=404, detail="Unknown node on the sample graph.")
    km, path, pts, settled, ms = route(from_node, to_node)
    if not path:
        raise HTTPException(status_code=404, detail="No road path between those nodes.")
    return RouteResult(
        from_node=from_node, to_node=to_node, distance_km=round(km, 2), eta_min=eta_min(km),
        path=path, points=pts, settled=settled, compute_ms=ms,
    )
