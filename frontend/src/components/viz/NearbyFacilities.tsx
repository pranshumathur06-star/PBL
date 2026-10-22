import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hospital, ShieldCheck, Flame, PhoneCall, Route as RouteIcon } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { GraphData, NearbyFacility } from "@/types";

const TYPE_META: Record<string, { label: string; color: string; Icon: typeof Hospital }> = {
  hospital: { label: "Hospitals", color: "#F87171", Icon: Hospital },
  police: { label: "Police stations", color: "#60A5FA", Icon: ShieldCheck },
  fire: { label: "Fire stations", color: "#FBBF24", Icon: Flame },
};

// Closest hospitals / police / fire stations to a report, ranked by true shortest-path
// distance on the sample Dehradun graph, with the selected route drawn on the map.
export default function NearbyFacilities({ node, approximate = false }: { node: string; approximate?: boolean }) {
  const graph = useQuery({ queryKey: ["routing-graph"], queryFn: () => apiGet<GraphData>("/routing/graph"), staleTime: 3600_000, retry: false });
  const near = useQuery({
    queryKey: ["nearby", node],
    queryFn: () => apiGet<NearbyFacility[]>(`/routing/nearby?node=${encodeURIComponent(node)}&types=hospital,police,fire&limit=3`),
    enabled: !!node,
    staleTime: 300_000,
    retry: false,
  });
  const [picked, setPicked] = useState<string | null>(null);
  const list = near.data ?? [];
  const selected = list.find((f) => f.name === picked) ?? list[0];
  const nodes = graph.data?.nodes ?? {};
  const me = nodes[node];

  const grouped = useMemo(() => {
    const g: Record<string, NearbyFacility[]> = {};
    for (const f of list) (g[f.type] ??= []).push(f);
    return g;
  }, [list]);

  // Zoom the map to the report and the facilities listed, so routes are readable.
  const view = useMemo(() => {
    const pts: number[][] = [];
    if (me) pts.push(me);
    for (const f of list) { const p = nodes[f.node]; if (p) pts.push(p); }
    if (pts.length < 2) return { x: 0, y: 0, w: 620, h: 560 };
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const pad = 30;
    let x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    let w = Math.max(...xs) - x + pad, h = Math.max(...ys) - y + pad;
    const side = Math.max(w, h, 180);
    x -= (side - w) / 2; y -= (side - h) / 2; w = side; h = side;
    return { x, y, w, h };
  }, [me, list, nodes]);
  const k = view.w / 620; // keep marker sizes visually constant when zoomed

  if (near.isError || graph.isError) {
    return <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-[12.5px] text-slate-400" data-testid="nearby-unavailable">Nearby facilities are unavailable right now. In an emergency, call 112.</p>;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4" data-testid="nearby-facilities">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-extrabold">Nearest help around you</h2>
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">Sample map · demo facilities</span>
      </div>
      {approximate && (
        <p className="mt-1.5 text-[12px] text-amber-200/80" data-testid="nearby-approx-note">
          No area was picked for this report, so distances are measured from the city centre (approximate).
        </p>
      )}

      <div className="mt-3 grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0A1327]">
          {graph.data && me ? (
            <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="block aspect-square h-auto w-full" role="img" aria-label="Sample map showing your location and the route to the selected facility">
              <g stroke="#1C2C4C" strokeWidth={1.6 * k} fill="none">
                {graph.data.edges.map((e, i) => {
                  const a = nodes[String(e[0])], b = nodes[String(e[1])];
                  if (!a || !b) return null;
                  const pts = e[3]?.length ? [a, ...e[3], b] : [a, b];
                  return <polyline key={i} points={pts.map((p) => p.join(",")).join(" ")} />;
                })}
              </g>
              {list.map((f) => {
                const p = nodes[f.node];
                return p ? <circle key={f.name} cx={p[0]} cy={p[1]} r={(f === selected ? 9 : 6) * k} fill={TYPE_META[f.type]?.color ?? "#94A3B8"} stroke="#0A1327" strokeWidth={2 * k} /> : null;
              })}
              {selected && selected.points.length > 1 && (
                <polyline
                  key={selected.name}
                  points={selected.points.map((p) => p.join(",")).join(" ")}
                  fill="none" stroke="#38BDF8" strokeWidth={4.5 * k} strokeLinecap="round" strokeLinejoin="round"
                  pathLength={1} strokeDasharray="1" strokeDashoffset="1"
                  style={{ animation: "ease-draw 1.1s ease-out forwards" }}
                  data-testid="nearby-route-line"
                />
              )}
              <circle cx={me[0]} cy={me[1]} r={16 * k} fill="#E11D48" opacity="0.3" className="anim-ping" />
              <circle cx={me[0]} cy={me[1]} r={9 * k} fill="#E11D48" stroke="#FCA5A5" strokeWidth={2.5 * k} />
              <text x={me[0] + 13 * k} y={me[1] - 11 * k} fontSize={15 * k} fill="#FCA5A5">You (report)</text>
            </svg>
          ) : (
            <div className="h-60 animate-pulse bg-slate-800/50" />
          )}
        </div>

        <div className="flex flex-col gap-3">
          {near.isLoading && [0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-800/70" />)}
          {Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type];
            return (
              <div key={type}>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {meta && <meta.Icon className="h-3.5 w-3.5" style={{ color: meta.color }} aria-hidden="true" />}{meta?.label ?? type}
                  <a href={`tel:${items[0].helpline}`} className="ml-auto flex items-center gap-1 normal-case tracking-normal text-slate-300 hover:text-white" data-testid={`nearby-helpline-${type}`}>
                    <PhoneCall className="h-3 w-3" aria-hidden="true" />{items[0].helpline}
                  </a>
                </p>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {items.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => setPicked(f.name)}
                      aria-pressed={f === selected}
                      data-testid={`nearby-item-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${f === selected ? "border-ease-sky bg-ease-sky/10" : "border-slate-800 hover:border-slate-600"}`}
                    >
                      <span className="text-[13px] text-slate-200">{f.name}</span>
                      <span className="shrink-0 font-data text-[11.5px] text-slate-400">{f.distance_km.toFixed(1)} km · ~{f.eta_min} min</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <RouteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Ranked by true shortest-path distance on the sample graph; times assume ~21 km/h with no live traffic. This list does not contact any facility — call 112 for help.
      </p>
    </section>
  );
}
