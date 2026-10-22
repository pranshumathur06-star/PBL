import { useEffect, useState } from "react";
import {
  Megaphone, MapPin, LayoutDashboard, UserCheck, ShieldAlert, Siren, Route as RouteIcon, History,
} from "lucide-react";

const STAGES = [
  {
    icon: Megaphone, tag: "Live", title: "Citizen reports",
    body: "Anyone can report — guest, signed-in citizen, no account needed. No OTP, GPS or photo is ever required to get a report into the system.",
  },
  {
    icon: MapPin, tag: "Live", title: "Location & context",
    body: "Manual address, landmark and PIN by default; optional GPS coordinates when available. The report snaps to the nearest node on the Dehradun sample road graph.",
  },
  {
    icon: LayoutDashboard, tag: "Live", title: "Command Centre queue",
    body: "Every report lands in one priority queue sorted by severity and time, with category filters and free-text search for operators.",
  },
  {
    icon: UserCheck, tag: "Live", title: "Human review",
    body: "An operator acknowledges, adjusts priority and records the reason. Every transition is a deliberate, audited human decision.",
  },
  {
    icon: ShieldAlert, tag: "Live demo", title: "Risk signals",
    body: "Duplicate wording and submission bursts surface as signals to inform review — they are never treated as proof of fraud and never block or delay a report.",
  },
  {
    icon: Siren, tag: "Live demo", title: "Eligible assignment",
    body: "Units are matched by service type (ambulance, fire, police, mechanic) and base facility, with reassignment always available.",
  },
  {
    icon: RouteIcon, tag: "Live demo", title: "Shortest-path routing",
    body: "Dijkstra's algorithm computes the true shortest path over the 120-node sample graph, with distance in km and an honestly-labelled time estimate.",
  },
  {
    icon: History, tag: "Live demo", title: "Status & audit",
    body: "Citizens follow a status timeline and reply thread; operators produce an audit record with actor, reason and before/after values for every consequential action.",
  },
];

// Interactive system flow: click any stage for its explanation; auto-advances until touched.
export default function FlowDiagram() {
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setActive((a) => (a + 1) % STAGES.length), 4200);
    return () => clearInterval(id);
  }, [hold]);

  const Current = STAGES[active];
  const Icon = Current.icon;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]" data-testid="flow-diagram" onMouseEnter={() => setHold(true)}>
      {/* stage rail */}
      <ol className="flex flex-col gap-1">
        {STAGES.map((s, i) => {
          const SIcon = s.icon;
          const on = i === active;
          return (
            <li key={s.title}>
              <button
                onClick={() => { setActive(i); setHold(true); }}
                aria-expanded={on}
                data-testid={`flow-stage-${i}`}
                className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-300 ${
                  on ? "border-ease-blue/50 bg-[#0D1B3E] shadow-[0_8px_30px_rgba(37,99,235,0.18)]" : "border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors ${
                  on ? "border-ease-sky/60 bg-ease-blue/20 text-ease-sky" : "border-ease-line bg-ease-card text-slate-400 group-hover:text-slate-200"
                }`}>
                  <SIcon className="h-4 w-4" aria-hidden="true" />
                  {on && <span className="absolute inset-0 rounded-lg border border-ease-sky/40 anim-ping" aria-hidden="true" />}
                </span>
                <span className="flex-1">
                  <span className={`block text-sm font-semibold ${on ? "text-white" : "text-slate-300"}`}>{s.title}</span>
                </span>
                <span className={`rounded border px-1.5 py-px text-[10px] font-bold ${
                  s.tag === "Live" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}>{s.tag}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* detail panel */}
      <div className="relative overflow-hidden rounded-2xl border border-ease-line bg-ease-panel p-6" data-testid="flow-detail-panel">
        <div className="grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative">
          <span className="font-data text-[11px] uppercase tracking-[0.2em] text-ease-sky">Stage {active + 1} / {STAGES.length}</span>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-ease-blue/15 text-ease-sky">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-xl font-bold text-white">{Current.title}</h3>
          </div>
          <p className="mt-4 min-h-[96px] text-sm leading-relaxed text-slate-300">{Current.body}</p>
          <div className="mt-6 flex gap-1.5" role="tablist" aria-label="Flow stages">
            {STAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActive(i); setHold(true); }}
                aria-label={`Stage ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-7 bg-ease-sky" : "w-3 bg-slate-600 hover:bg-slate-500"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
