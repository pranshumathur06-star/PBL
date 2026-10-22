import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Route as RouteIcon, Timer, GitBranch, Zap } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { GraphData, RouteResult } from "@/types";

const FAC_COLOR: Record<string, string> = {
  hospital: "#F87171", fire: "#FBBF24", police: "#60A5FA", pharmacy: "#34D399", mech: "#A78BFA",
};

// Interactive Dehradun shortest-path visualiser over the sample road graph.
// explore (default): pick origin/destination from facilities. Ops console: pass
// explore={false} with fixed={from,to} for a locked route view.
export default function DijkstraMap({
  fixed = undefined,
  explore = true,
  className = "",
  compact = false,
}: {
  fixed?: { from: string; to: string } | null;
  explore?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const graph = useQuery({
    queryKey: ["routing-graph"],
    queryFn: () => apiGet<GraphData>("/routing/graph"),
    staleTime: 3600_000,
    retry: false,
  });

  const facilities = graph.data?.facilities ?? [];
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const fromNode = fixed ? fixed.from : from || facilities[6]?.at || graph.data?.center_node || "";
  const toNode = fixed ? fixed.to : to || facilities[3]?.at || graph.data?.center_node || "";
  const pickers = explore && !fixed;

  const routeQ = useQuery({
    queryKey: ["route", fromNode, toNode],
    queryFn: () => apiGet<RouteResult>(`/routing/route/nodes?from_node=${fromNode}&to_node=${toNode}`),
    enabled: !!fromNode && !!toNode,
    staleTime: 60_000,
    retry: false,
  });

  const nodeById = useMemo(() => graph.data?.nodes ?? {}, [graph.data]);

  if (graph.isLoading) {
    return (
      <div className={`grid place-items-center rounded-2xl border border-ease-line bg-ease-panel text-sm text-slate-400 ${className}`} style={{ minHeight: 420 }}>
        Loading the sample road graph…
      </div>
    );
  }
  if (graph.isError || !graph.data) {
    // Degrade to a labelled panel — the page must stay up when the demo backend is unreachable.
    return (
      <div className={`grid place-items-center rounded-2xl border border-ease-line bg-ease-panel p-8 text-center ${className}`} style={{ minHeight: 420 }}>
        <div>
          <p className="text-sm font-medium text-slate-200">Sample routing graph unavailable</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            The Dehradun demonstration graph is served by the demo backend, which could not be
            reached. Everything else on this page still works.
          </p>
        </div>
      </div>
    );
  }

  const route = routeQ.data;

  return (
    <div className={`overflow-hidden rounded-2xl border border-ease-line bg-ease-panel ${className}`} data-testid="dijkstra-map">
      <svg viewBox="0 0 620 560" className="block h-auto w-full" role="img" aria-label="Sample Dehradun road graph with an animated shortest-path route">
        {/* edges */}
        <g stroke="#1C2C4C" strokeWidth="1.4" strokeLinecap="round">
          {graph.data.edges.map((e, i) => {
            const a = nodeById[String(e[0])], b = nodeById[String(e[1])];
            if (!a || !b) return null;
            const geom = e[3];
            const pts = geom && geom.length ? geom.map((p) => p.join(",")).join(" ") : `${a[0]},${a[1]} ${b[0]},${b[1]}`;
            return <polyline key={i} points={pts} fill="none" />;
          })}
        </g>
        {/* nodes */}
        <g fill="#2A3E63">
          {Object.entries(nodeById).map(([id, p]) => (
            <circle key={id} cx={p[0]} cy={p[1]} r={compact ? 1.4 : 1.7} />
          ))}
        </g>
        {/* facilities */}
        {facilities.map((f) => (
          <g key={f.n}>
            <circle cx={f.p[0]} cy={f.p[1]} r="4" fill={FAC_COLOR[f.t] ?? "#94A3B8"} stroke="#0A1327" strokeWidth="1.5" />
            {!compact && f.t !== "pharmacy" && f.t !== "mech" && (
              <text x={f.p[0] + 7} y={f.p[1] + 3.5} fontSize="9" fill="#7C93B8">{f.n}</text>
            )}
          </g>
        ))}
        {/* route */}
        {route && route.points.length > 1 && (
          <>
            <polyline
              key={`halo-${route.from_node}-${route.to_node}`}
              points={route.points.map((p) => p.join(",")).join(" ")}
              fill="none" stroke="rgba(56,189,248,0.25)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
            />
            <polyline
              key={route.from_node + route.to_node + route.points.length}
              points={route.points.map((p) => p.join(",")).join(" ")}
              fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              pathLength={1} strokeDasharray="1" strokeDashoffset="1"
              style={{ animation: "ease-draw 1.2s ease-out forwards" }}
              data-testid="dijkstra-route-line"
            />
            <circle cx={route.points[0][0]} cy={route.points[0][1]} r="6.5" fill="#0A1327" stroke="#34D399" strokeWidth="3" />
            <g>
              <circle cx={route.points[route.points.length - 1][0]} cy={route.points[route.points.length - 1][1]} r="12" fill="#E11D48" opacity="0.3" className="anim-ping" />
              <circle cx={route.points[route.points.length - 1][0]} cy={route.points[route.points.length - 1][1]} r="6.5" fill="#E11D48" stroke="#FCA5A5" strokeWidth="2" />
            </g>
          </>
        )}
      </svg>

      <div className="border-t border-ease-line px-4 py-3">
        {pickers && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="text-[11px] uppercase tracking-wider text-slate-500">From</label>
            <select
              value={fromNode} onChange={(e) => setFrom(e.target.value)} data-testid="dijkstra-from-select"
              className="rounded-lg border border-ease-line2 bg-ease-card px-2.5 py-1.5 text-xs text-slate-200 focus:outline-ease-sky"
            >
              {facilities.map((f) => <option key={f.n} value={f.at}>{f.n}</option>)}
            </select>
            <label className="ml-2 text-[11px] uppercase tracking-wider text-slate-500">To</label>
            <select
              value={toNode} onChange={(e) => setTo(e.target.value)} data-testid="dijkstra-to-select"
              className="rounded-lg border border-ease-line2 bg-ease-card px-2.5 py-1.5 text-xs text-slate-200 focus:outline-ease-sky"
            >
              {facilities.map((f) => <option key={f.n} value={f.at}>{f.n}</option>)}
            </select>
            <button
              onClick={() => { const f = fromNode; setFrom(toNode); setTo(f); }}
              className="ml-auto rounded-lg border border-ease-line2 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-ease-sky hover:text-white"
              data-testid="dijkstra-swap-button"
            >
              Swap
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="dijkstra-stats">
          <div className="rounded-lg bg-ease-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><RouteIcon className="h-3 w-3" /> Shortest path</div>
            <div className="font-data text-base font-bold text-white" data-testid="dijkstra-distance">{route ? `${route.distance_km.toFixed(1)} km` : "—"}</div>
          </div>
          <div className="rounded-lg bg-ease-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><Timer className="h-3 w-3" /> Est. time*</div>
            <div className="font-data text-base font-bold text-white">{route ? `${route.eta_min} min` : "—"}</div>
          </div>
          <div className="rounded-lg bg-ease-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><GitBranch className="h-3 w-3" /> Nodes settled</div>
            <div className="font-data text-base font-bold text-white">{route ? route.settled : "—"}</div>
          </div>
          <div className="rounded-lg bg-ease-card/70 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500"><Zap className="h-3 w-3" /> Compute</div>
            <div className="font-data text-base font-bold text-white" data-testid="dijkstra-compute">{route ? `${route.compute_ms.toFixed(2)} ms` : "—"}</div>
          </div>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">
          *Distance is a true shortest-path result on the {graph.data.node_count}-node sample graph.
          Time is an estimate at an assumed ~21 km/h fleet average — not live traffic.
          Illustrative geometry, not a navigation map.
        </p>
      </div>
    </div>
  );
}
