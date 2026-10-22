import { useState } from "react";
import { Siren, Undo2, CircleAlert, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

// Fully client-side interactive preview of the command centre using SAMPLE data.
// Every element is labelled; the real app lives at /ops.
type Sample = { code: string; cat: string; sev: "Critical" | "High" | "Medium" | "Low"; text: string; area: string; unit: string | null; km: number | null };

const SAMPLES: Sample[] = [
  { code: "SAMPLE-101", cat: "Medical", sev: "Critical", text: "Elderly person with chest pain, conscious", area: "Rajpur Road area", unit: null, km: null },
  { code: "SAMPLE-103", cat: "Fire", sev: "Critical", text: "Smoke from first-floor kitchen, residents leaving", area: "Patel Nagar area", unit: null, km: null },
  { code: "SAMPLE-104", cat: "Crime / theft", sev: "Medium", text: "Bag snatched near the market, suspect left on foot", area: "Clock Tower area", unit: null, km: null },
  { code: "SAMPLE-105", cat: "Flood / disaster", sev: "High", text: "Water entering ground-floor shops near a drain", area: "Graphic Era side", unit: "FIRE-04", km: 3.8 },
];

const SEV_TONE: Record<string, string> = {
  Critical: "bg-red-500/15 text-red-300 border-red-500/40",
  High: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Medium: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  Low: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

export default function CommandPreview() {
  const [sel, setSel] = useState(0);
  const [assigned, setAssigned] = useState<Record<string, { unit: string; km: number }>>({});

  const s = SAMPLES[sel];
  const a = assigned[s.code] ?? (s.unit ? { unit: s.unit, km: s.km ?? 0 } : null);

  const assign = () => {
    const eligible: Record<string, string> = { Medical: "AMB-12", Fire: "FIRE-04", "Crime / theft": "PCR-03", "Flood / disaster": "FIRE-02" };
    const km: Record<string, number> = { Medical: 2.4, Fire: 1.7, "Crime / theft": 1.2, "Flood / disaster": 3.8 };
    setAssigned((m) => ({ ...m, [s.code]: { unit: eligible[s.cat], km: km[s.cat] } }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ease-line bg-ease-panel shadow-[0_40px_90px_rgba(2,8,23,0.5)]" data-testid="command-preview">
      <div className="flex items-center justify-between border-b border-ease-line px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 anim-blink" aria-hidden="true" /> Live operations preview
        </span>
        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">Sample data</span>
      </div>

      <div className="grid md:grid-cols-[1fr_1.2fr]">
        {/* mini queue */}
        <div className="flex flex-col border-b border-ease-line md:border-b-0 md:border-r">
          <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Incident queue</div>
          <div className="flex flex-col">
            {SAMPLES.map((it, i) => (
              <button
                key={it.code}
                onClick={() => setSel(i)}
                aria-pressed={i === sel}
                data-testid={`command-preview-incident-${it.code}`}
                className={`flex items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                  i === sel ? "border-ease-sky bg-ease-card/80" : "border-transparent hover:bg-white/[0.03]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-data text-[11px] text-slate-400">{it.code}</span>
                    <span className={`rounded border px-1.5 text-[9.5px] font-bold ${SEV_TONE[it.sev]}`}>{it.sev}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[12.5px] text-slate-200">{it.text}</div>
                  <div className="text-[10.5px] text-slate-500">{it.area}</div>
                </div>
                {(assigned[it.code] || it.unit) && (
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-300">
                    {(assigned[it.code]?.unit ?? it.unit)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* detail + mini map */}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${SEV_TONE[s.sev]}`}>{s.sev}</span>
            <span className="rounded border border-ease-line2 bg-ease-card px-2 py-0.5 text-[11px] text-slate-300">{s.cat}</span>
            <span className="font-data text-[11px] text-slate-500">{s.code}</span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-200">{s.text}</p>
          <p className="mt-1 text-xs text-slate-500">{s.area} · illustrative location</p>

          {/* mini route map */}
          <div className="relative mt-3 overflow-hidden rounded-xl border border-ease-line bg-[#0A1327] p-3">
            <svg viewBox="0 0 300 110" className="block h-auto w-full" aria-hidden="true">
              <g stroke="#16283F" strokeWidth="1.2">
                <path d="M0 30 H300 M0 78 H300 M60 0 V110 M150 0 V110 M240 0 V110" fill="none" />
              </g>
              {a && (
                <>
                  <path d={s.code === "SAMPLE-103" ? "M40 88 H150 V30 H262" : "M60 22 V78 H240"} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: "ease-draw 1.1s ease-out forwards" }} key={s.code + (a.unit ?? "")} />
                  <circle cx={s.code === "SAMPLE-103" ? 40 : 60} cy={s.code === "SAMPLE-103" ? 88 : 22} r="5" fill="#0A1327" stroke="#34D399" strokeWidth="2.5" />
                  <circle cx={s.code === "SAMPLE-103" ? 262 : 240} cy={s.code === "SAMPLE-103" ? 30 : 78} r="10" fill="#E11D48" opacity="0.3" className="anim-ping" />
                  <circle cx={s.code === "SAMPLE-103" ? 262 : 240} cy={s.code === "SAMPLE-103" ? 30 : 78} r="5.5" fill="#E11D48" stroke="#FCA5A5" strokeWidth="2" />
                </>
              )}
              {!a && <text x="150" y="60" textAnchor="middle" fontSize="10" fill="#475569">Assign a unit to see its shortest path</text>}
            </svg>
            {a && (
              <p className="mt-1 text-center font-data text-[10.5px] text-slate-400">
                {a.unit} · shortest path {a.km.toFixed(1)} km · sample graph
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!a ? (
              <button onClick={assign} data-testid="command-preview-assign-button" className="inline-flex items-center gap-1.5 rounded-lg bg-ease-blue px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-[#1D4ED8]">
                <Siren className="h-4 w-4" aria-hidden="true" /> Assign eligible unit
              </button>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12.5px] font-semibold text-emerald-300" data-testid="command-preview-assigned-badge">
                  <CircleAlert className="h-4 w-4" aria-hidden="true" /> {a.unit} assigned (simulated)
                </span>
                <button
                  onClick={() => setAssigned((m) => { const c = { ...m }; delete c[s.code]; return c; })}
                  data-testid="command-preview-reset-button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ease-line2 px-3 py-2 text-[12.5px] text-slate-300 transition hover:border-ease-sky hover:text-white"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" /> Reset
                </button>
              </>
            )}
            <Link to="/ops" className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-ease-red px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:bg-[#BE123C]" data-testid="command-preview-open-ops">
              Open the real Command Centre <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
