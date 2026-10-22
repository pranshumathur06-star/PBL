import { useEffect, useRef, useState } from "react";

// Hero visualisation: a simulated report arrives, an operator triages it, a unit is
// assigned and travels the shortest path. Entirely client-side and clearly labelled —
// no backend, no real incident, no real unit.
const ROUTE_D = "M60 250 H150 V170 H290 V90 H430";
const TOTAL_KM = 2.6;
const CYCLE = 10800;

type Phase = 0 | 1 | 2 | 3 | 4;

const FEED: { phase: Phase; badge: string; tone: string; text: string }[] = [
  { phase: 1, badge: "Critical", tone: "bg-red-500/15 text-red-300 border-red-500/40", text: "New report · Medical" },
  { phase: 2, badge: "Assigned", tone: "bg-sky-500/15 text-sky-300 border-sky-500/40", text: "Unit AMB-12 (sample)" },
  { phase: 3, badge: "En route", tone: "bg-amber-500/15 text-amber-300 border-amber-500/40", text: "Following shortest path" },
  { phase: 4, badge: "On scene", tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", text: "Simulated arrival" },
];

export default function IncidentPipeline() {
  const pathRef = useRef<SVGPathElement>(null);
  const unitRef = useRef<SVGGElement>(null);
  const [phase, setPhase] = useState<Phase>(0);
  const [km, setKm] = useState(0);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const path = pathRef.current;
    if (!path) return;
    const L = path.getTotalLength();

    if (reduced) {
      // Static, fully readable frame.
      path.style.strokeDasharray = `${L} 0`;
      setPhase(4);
      setKm(0);
      setClock(62);
      return;
    }

    let raf = 0;
    let t0: number | null = null;
    const frame = (now: number) => {
      if (t0 === null) t0 = now;
      const t = (now - t0) % CYCLE;
      const p: Phase = t < 1200 ? 0 : t < 2600 ? 1 : t < 4000 ? 2 : t < 9400 ? 3 : 4;
      setPhase(p);
      setClock(Math.floor(t / 1000));

      if (p < 2) {
        path.style.strokeDasharray = `0 ${L}`;
      } else if (p === 2) {
        const k = Math.min(1, (t - 2600) / 1400);
        path.style.strokeDasharray = `${L * k} ${L}`;
      } else {
        path.style.strokeDasharray = `${L} 0`;
      }

      if (p >= 3 && unitRef.current) {
        const f = p === 3 ? Math.min(1, (t - 4000) / 5400) : 1;
        const q = path.getPointAtLength(L * f);
        unitRef.current.setAttribute("transform", `translate(${q.x}, ${q.y})`);
        setKm(Math.round(TOTAL_KM * (1 - f) * 10) / 10);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="glass relative overflow-hidden rounded-2xl shadow-[0_40px_90px_rgba(2,8,23,0.55)]" data-testid="hero-incident-pipeline">
      <div className="flex items-center justify-between border-b border-ease-line/70 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 anim-blink" aria-hidden="true" />
          Simulated response pipeline
        </div>
        <span className="rounded border border-ease-line2 bg-ease-card px-2 py-0.5 font-data text-[10px] text-slate-400" data-testid="hero-pipeline-clock">
          00:{String(clock).padStart(2, "0")}
        </span>
      </div>

      <div className="relative bg-[#0A1327]">
        <svg viewBox="0 0 520 290" className="block h-auto w-full" role="img" aria-label="Animated demonstration: a report arrives, an operator reviews it, a response unit is assigned and follows the shortest path">
          {/* abstract city blocks */}
          <g fill="#0E1B36" stroke="#16283F" strokeWidth="1">
            <rect x="20" y="20" width="100" height="70" rx="6" /><rect x="20" y="110" width="100" height="60" rx="6" />
            <rect x="20" y="190" width="100" height="70" rx="6" /><rect x="140" y="20" width="120" height="130" rx="6" />
            <rect x="170" y="190" width="90" height="70" rx="6" /><rect x="280" y="20" width="110" height="50" rx="6" />
            <rect x="310" y="110" width="80" height="110" rx="6" /><rect x="410" y="20" width="90" height="50" rx="6" />
            <rect x="410" y="120" width="90" height="60" rx="6" /><rect x="280" y="190" width="60" height="70" rx="6" />
            <rect x="360" y="200" width="140" height="60" rx="6" />
          </g>
          {/* street glow under route */}
          <path d={ROUTE_D} fill="none" stroke="#0F2A52" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          {/* the route, drawn by the phase engine */}
          <path ref={pathRef} d={ROUTE_D} fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.6))" }} />
          {/* base station */}
          <g>
            <circle cx="60" cy="250" r="13" fill="#111C33" stroke="#34D399" strokeWidth="3" />
            <path d="M60 244v12M54 250h12" stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" />
            <text x="60" y="278" textAnchor="middle" fontSize="10" fill="#94A3B8">Doon Hospital (sample)</text>
          </g>
          {/* incident marker */}
          <g opacity={phase >= 1 ? 1 : 0} style={{ transition: "opacity .5s ease" }} data-testid="hero-pipeline-incident">
            <circle cx="430" cy="90" r="18" fill="#E11D48" opacity="0.28" className="anim-ping" />
            <circle cx="430" cy="90" r="10" fill="#E11D48" stroke="#FCA5A5" strokeWidth="2" />
            <text x="430" y="66" textAnchor="middle" fontSize="10" fill="#FCA5A5">Incident (simulated)</text>
          </g>
          {/* travelling unit */}
          <g ref={unitRef} transform="translate(60,250)" opacity={phase >= 3 ? 1 : 0} style={{ transition: "opacity .4s ease" }} data-testid="hero-pipeline-unit">
            <circle r="12" fill="#F8FAFC" />
            <path d="M0 -6v12M-6 0h12" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
          </g>
        </svg>
        <span className="absolute bottom-2 right-3 font-data text-[10px] text-slate-500">Simulated demonstration · sample data</span>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-4 px-4 py-3">
        <ul className="flex flex-col gap-1.5 text-[12.5px]" aria-live="polite" data-testid="hero-pipeline-feed">
          {FEED.filter((f) => f.phase <= phase).slice(-3).map((f) => (
            <li key={f.phase} className="flex items-center gap-2">
              <span className={`rounded border px-1.5 py-px text-[10px] font-bold ${f.tone}`}>{f.badge}</span>
              <span className="text-slate-300">{f.text}</span>
            </li>
          ))}
          {phase === 0 && <li className="text-slate-500">Monitoring sample feeds…</li>}
        </ul>
        <div className="text-right">
          <div className="font-data text-xl font-bold text-white" data-testid="hero-pipeline-km">{(phase < 3 ? TOTAL_KM : km).toFixed(1)} km</div>
          <div className="text-[10.5px] text-slate-500">remaining · sample route</div>
        </div>
      </div>
    </div>
  );
}
