import { useEffect, useRef, useState } from "react";
import {
  Siren, MapPin, ClipboardCheck, Route as RouteIcon, Users, Radio, FileClock, PhoneCall,
} from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead } from "@/components/site/ui";

const STEPS = [
  {
    icon: Siren, title: "Report an emergency",
    body: "A citizen describes the situation in plain words and picks a category. Guest or signed-in — no OTP, no GPS, no photo is required. A life-in-danger flag maps straight to Critical.",
    visual: "report",
  },
  {
    icon: MapPin, title: "Capture available context",
    body: "Address, landmark and PIN are typed; GPS coordinates are optional with an accuracy read-out. The report snaps to the nearest node on the sample road graph — context, never a gate.",
    visual: "location",
  },
  {
    icon: ClipboardCheck, title: "Review & prioritise",
    body: "The report lands in the Command Centre queue. An operator acknowledges it, adjusts priority with a reason, and the keyword heuristic's suggestion is visible but never final.",
    visual: "review",
  },
  {
    icon: RouteIcon, title: "Inspect resources & routing",
    body: "Eligible units by service type and base facility; Dijkstra computes the shortest path from the unit's base to the incident over the 120-node sample graph.",
    visual: "routing",
  },
  {
    icon: Users, title: "Assign a response unit",
    body: "One audited action assigns the unit — service-type mismatches are rejected by the backend. Reassignment releases the previous unit automatically.",
    visual: "assign",
  },
  {
    icon: Radio, title: "Track through status updates",
    body: "Reported → Acknowledged → Under review → Assigned → En route → On scene. The citizen timeline mirrors every transition, with a reply thread in both directions.",
    visual: "track",
  },
  {
    icon: FileClock, title: "Record the outcome & audit history",
    body: "Resolve, then close — or reopen if things change. Every action along the way sits in the audit ledger: actor, role, reason, before → after.",
    visual: "audit",
  },
];

// Scroll-driven 7-step lifecycle. The steps are plain text (understandable without
// animation); the sticky visual is a supplement that follows the scroll position.
export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLDivElement[];
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-38% 0px -48% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="bg-[#F8FAFC]">
      <SiteNav />

      <section className="relative overflow-hidden bg-ease-navy pt-36 pb-20 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <Container className="relative">
          <SectionHead
            dark
            eyebrow="How EASE works"
            title="Seven steps every report travels."
            sub="Scroll through the lifecycle — the same one the live demo runs, from first word to final audit entry."
          />
          <div className="mt-8 flex items-center gap-3" aria-hidden="true">
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-ease-sky transition-all duration-500"
                style={{ width: `${((active + 1) / STEPS.length) * 100}%` }}
                data-testid="how-progress-bar"
              />
            </div>
            <span className="font-data text-xs text-slate-400">{active + 1} / {STEPS.length}</span>
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            {/* steps rail */}
            <div className="flex flex-col gap-6">
              {STEPS.map((s, i) => (
                <div
                  key={s.title}
                  data-index={i}
                  ref={(el) => { refs.current[i] = el; }}
                  className={`relative rounded-2xl border p-6 transition-all duration-300 ${
                    i === active ? "border-ease-blue/50 bg-white shadow-[0_20px_50px_rgba(37,99,235,0.12)]" : "border-slate-200 bg-white/50"
                  }`}
                  data-testid={`how-step-${i}`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${i === active ? "bg-ease-blue text-white" : "bg-slate-100 text-slate-500"}`}>
                      <s.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className={`font-data text-[11px] font-bold uppercase tracking-[0.18em] ${i === active ? "text-ease-blue" : "text-slate-400"}`}>Step {i + 1}</p>
                      <h3 className="mt-1 font-heading text-lg font-bold text-slate-900">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* sticky visual */}
            <div className="hidden lg:block">
              <div className="sticky top-32 rounded-2xl border border-ease-line bg-ease-panel p-6" data-testid="how-visual-panel">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-500">Stage visual · illustrative</p>
                <div className="mt-4 min-h-[380px]">
                  {STEPS[active].visual === "report" && (
                    <div className="flex flex-col gap-3">
                      {["Medical", "Fire", "Accident", "Crime", "Flood", "Other"].map((c, i) => (
                        <div key={c} className={`rounded-xl border px-4 py-3 text-sm ${i === 0 ? "border-ease-red/50 bg-ease-red/10 text-red-200" : "border-ease-line bg-ease-card text-slate-300"}`}>{c}</div>
                      ))}
                      <div className="rounded-xl bg-ease-red py-3 text-center text-sm font-bold text-white">Send emergency report</div>
                    </div>
                  )}
                  {STEPS[active].visual === "location" && (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-xl border border-ease-line bg-ease-card p-4 text-sm text-slate-300">Address · Rajpur Road, Dehradun · PIN 248001</div>
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">GPS · 30.3165, 78.0322 · ±12 m · optional</div>
                      <div className="relative h-44 overflow-hidden rounded-xl border border-ease-line bg-[#0A1327]">
                        <svg viewBox="0 0 300 160" className="h-full w-full">
                          <g stroke="#1C2C4C" strokeWidth="1.5"><path d="M0 50 H300 M0 110 H300 M80 0 V160 M200 0 V160" fill="none" /></g>
                          <circle cx="200" cy="110" r="22" fill="#38BDF8" opacity="0.15" className="anim-ping" />
                          <circle cx="200" cy="110" r="7" fill="#38BDF8" stroke="#0A1327" strokeWidth="2" />
                          <text x="212" y="114" fontSize="10" fill="#7C93B8">snapped to nearest node</text>
                        </svg>
                      </div>
                    </div>
                  )}
                  {STEPS[active].visual === "review" && (
                    <div className="flex flex-col gap-3">
                      {[
                        ["Critical", "border-red-500/40 bg-red-500/10 text-red-300"],
                        ["High", "border-amber-500/40 bg-amber-500/10 text-amber-300"],
                        ["Medium", "border-sky-500/40 bg-sky-500/10 text-sky-300"],
                        ["Low", "border-slate-500/40 bg-slate-500/10 text-slate-300"],
                      ].map(([sev, tone], i) => (
                        <div key={sev} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${tone}`}>
                          <span className="font-bold">{sev}</span>
                          <span className="font-data text-[11px] opacity-70">{["life in danger", "urgent wording", "recognised category", "no keywords"][i]}</span>
                        </div>
                      ))}
                      <div className="rounded-xl border border-ease-line bg-ease-card p-4 text-[12.5px] text-slate-400">Operator override: any change, any reason — audited.</div>
                    </div>
                  )}
                  {STEPS[active].visual === "routing" && (
                    <div className="relative h-72 overflow-hidden rounded-xl border border-ease-line bg-[#0A1327]">
                      <svg viewBox="0 0 300 240" className="h-full w-full">
                        <g stroke="#1C2C4C" strokeWidth="1.4" fill="none">
                          <path d="M30 200 H120 V120 H200 V60 H270 M120 200 H240 V120 M200 60 V120" />
                        </g>
                        <path d="M30 200 H120 V120 H200 V60 H270" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="1" style={{ animation: "ease-draw 1.4s ease-out forwards" }} />
                        <circle cx="30" cy="200" r="7" fill="#0A1327" stroke="#34D399" strokeWidth="3" />
                        <circle cx="270" cy="60" r="10" fill="#E11D48" opacity="0.3" className="anim-ping" />
                        <circle cx="270" cy="60" r="6" fill="#E11D48" stroke="#FCA5A5" strokeWidth="2" />
                      </svg>
                      <span className="absolute bottom-3 left-3 font-data text-[11px] text-slate-400">shortest path · sample graph</span>
                    </div>
                  )}
                  {STEPS[active].visual === "assign" && (
                    <div className="flex flex-col gap-3">
                      {[
                        ["AMB-12", "Doon Hospital · ALS", "Assigned", "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"],
                        ["AMB-07", "Max Super Speciality · BLS", "Available", "text-slate-300 border-ease-line bg-ease-card"],
                        ["FIRE-04", "Dehradun Fire Station", "Available", "text-slate-300 border-ease-line bg-ease-card"],
                        ["PCR-03", "Kotwali Police Station", "Available", "text-slate-300 border-ease-line bg-ease-card"],
                      ].map(([id, fac, stat, tone]) => (
                        <div key={id} className="flex items-center justify-between rounded-xl border border-ease-line bg-ease-card px-4 py-3">
                          <div>
                            <div className="font-data text-sm text-white">{id}</div>
                            <div className="text-[11px] text-slate-500">{fac}</div>
                          </div>
                          <span className={`rounded border px-2 py-0.5 text-[10.5px] font-bold ${tone}`}>{stat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {STEPS[active].visual === "track" && (
                    <div className="flex flex-col gap-3">
                      {["Reported", "Acknowledged", "Under review", "Assigned", "En route", "On scene"].map((st, i) => (
                        <div key={st} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${i <= 3 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-ease-line bg-ease-card text-slate-400"}`}>
                          <span className={`grid h-4 w-4 place-items-center rounded-full border text-[9px] ${i <= 3 ? "border-emerald-400" : "border-slate-600"}`}>{i <= 3 ? "✓" : ""}</span>
                          {st}
                        </div>
                      ))}
                    </div>
                  )}
                  {STEPS[active].visual === "audit" && (
                    <div className="flex flex-col gap-2.5 font-data text-[12px]">
                      {[
                        ["A-0131", "Resolved", "SAMPLE-101", "Meenakshi R. (Dispatcher)"],
                        ["A-0130", "Unit assigned", "SAMPLE-101", "reason: nearest ALS unit"],
                        ["A-0129", "Priority change", "SAMPLE-101", "High → Critical"],
                        ["A-0128", "Acknowledged", "SAMPLE-101", "Meenakshi R. (Dispatcher)"],
                      ].map(([n, a, t, w]) => (
                        <div key={n} className="rounded-xl border border-ease-line bg-ease-card px-4 py-3">
                          <div className="flex justify-between text-slate-400"><span>{a}</span><span>{n}</span></div>
                          <div className="mt-1 text-slate-200">{t} · {w}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Reveal>
            <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-[#FFF5F5] p-6 sm:flex-row sm:items-center">
              <PhoneCall className="h-5 w-5 shrink-0 text-ease-red" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-slate-700">
                This lifecycle is a demonstration. None of these seven steps contacts a real
                ambulance, fire crew or police station — in a genuine emergency in India, call{" "}
                <strong>112</strong> first.
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
