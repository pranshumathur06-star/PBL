import { useEffect, useRef, useState } from "react";
import { MapPin, PhoneCall, CheckCircle2, Radio, Navigation, ChevronRight } from "lucide-react";

const STEPS = [
  {
    key: "report", label: "Describe it",
    title: "Report in under a minute",
    body: "Pick a category, describe the situation in plain words, say whether a life is in danger. No account, no OTP, no photo needed — ever.",
  },
  {
    key: "location", label: "Confirm where",
    title: "Share location your way",
    body: "Type an address or landmark — or tap for GPS coordinates with an accuracy read-out. Weak GPS degrades to manual entry instead of blocking you.",
  },
  {
    key: "sent", label: "Send it",
    title: "Straight to the command centre",
    body: "The report lands in the live queue with a reference code. Dispatch reviews it — sending is never presented as an ambulance already on the way.",
  },
  {
    key: "track", label: "Follow up",
    title: "Track status and reply",
    body: "A timeline shows each stage — acknowledged, under review, unit assigned — and you can reply to the command centre in the same thread.",
  },
];

// Staged citizen-app walkthrough: the left steps drive the phone; the phone tabs drive back.
export default function PhoneSim() {
  const [step, setStep] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = stepRefs.current.filter(Boolean) as HTMLDivElement[];
    if (reduced || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.index);
            setStep(idx);
          }
        }
      },
      { rootMargin: "-42% 0px -42% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_auto]" data-testid="phone-sim">
      {/* steps */}
      <div className="flex flex-col gap-4 lg:max-w-md">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            data-index={i}
            ref={(el) => { stepRefs.current[i] = el; }}
            onClick={() => setStep(i)}
            className={`cursor-pointer rounded-2xl border p-5 transition-all duration-300 ${
              i === step ? "border-ease-blue/50 bg-white shadow-[0_16px_40px_rgba(37,99,235,0.12)]" : "border-slate-200 bg-white/60 hover:border-slate-300"
            }`}
            data-testid={`phone-step-${i}`}
          >
            <div className="flex items-center justify-between">
              <span className={`font-data text-[11px] font-bold uppercase tracking-[0.18em] ${i === step ? "text-ease-blue" : "text-slate-400"}`}>
                Step {i + 1} · {s.label}
              </span>
              <ChevronRight className={`h-4 w-4 transition-transform ${i === step ? "translate-x-0.5 text-ease-blue" : "text-slate-300"}`} aria-hidden="true" />
            </div>
            <h3 className="mt-2 font-heading text-lg font-bold text-slate-900">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
          </div>
        ))}
        <a href="tel:112" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-ease-red px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)] transition hover:bg-[#BE123C]" data-testid="phone-sim-112">
          <PhoneCall className="h-4 w-4" aria-hidden="true" /> In immediate danger? Call 112
        </a>
      </div>

      {/* phone */}
      <div className="mx-auto w-[300px] lg:sticky lg:top-28">
        <div className="rounded-[40px] border border-slate-300 bg-slate-900 p-2.5 shadow-[0_40px_80px_rgba(2,8,23,0.35)]">
          <div className="relative overflow-hidden rounded-[32px] bg-[#0F172A] text-white">
            <div className="flex items-center justify-between px-5 pt-4 text-[10px] text-slate-400">
              <span>9:41</span><span>EASE Citizen</span><span>100%</span>
            </div>
            <div className="flex gap-1 px-4 pt-3" role="tablist" aria-label="Walkthrough screens">
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === step}
                  onClick={() => setStep(i)}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${i === step ? "bg-ease-sky" : "bg-slate-700"}`}
                  data-testid={`phone-tab-${i}`}
                  aria-label={s.label}
                />
              ))}
            </div>

            <div className="flex min-h-[430px] flex-col px-4 pb-6 pt-4">
              {step === 0 && (
                <div className="flex flex-col gap-3" data-testid="phone-screen-report">
                  <h4 className="font-heading text-base font-bold">What's happening?</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {["Medical", "Accident", "Fire", "Theft", "Flood", "Other"].map((c, i) => (
                      <span key={c} className={`rounded-lg border px-2 py-2.5 text-center text-[11px] font-medium ${i === 0 ? "border-ease-sky bg-ease-sky/10 text-ease-sky" : "border-slate-700 text-slate-300"}`}>{c}</span>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-3 text-[12px] leading-relaxed text-slate-300">
                    "My father collapsed in the shop, he is conscious but has severe chest
                    pain. We are at the pharmacy on Rajpur Road."
                    <span className="mt-2 block text-[10.5px] text-slate-500">Life in danger? — selected: yes</span>
                  </div>
                  <span className="mt-auto flex items-center gap-1.5 rounded-xl bg-ease-red px-3 py-3 text-center text-[13px] font-bold justify-center">
                    <Radio className="h-4 w-4" aria-hidden="true" /> Send emergency report
                  </span>
                </div>
              )}
              {step === 1 && (
                <div className="flex flex-col gap-3" data-testid="phone-screen-location">
                  <h4 className="font-heading text-base font-bold">Where is it?</h4>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5">
                    <Navigation className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <div className="text-[12px]">
                      <div className="font-medium text-slate-100">GPS attached</div>
                      <div className="text-[10.5px] text-slate-400">30.3165, 78.0322 · ±12 m · optional</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-[12px] text-slate-200">
                    Address or landmark<span className="block text-[10.5px] text-slate-400">Pharmacy, Rajpur Road · PIN 248001</span>
                  </div>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    No GPS? No problem — a typed address is enough to report.
                  </div>
                  <span className="mt-auto rounded-xl bg-ease-blue px-3 py-3 text-center text-[13px] font-bold">Confirm location</span>
                </div>
              )}
              {step === 2 && (
                <div className="flex flex-col items-center justify-center gap-3 text-center" data-testid="phone-screen-sent">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden="true" />
                  </span>
                  <h4 className="font-heading text-base font-bold">Report received</h4>
                  <p className="font-data text-2xl font-bold text-ease-sky">RPT-8F3K2A</p>
                  <p className="text-[12px] leading-relaxed text-slate-400">
                    Dispatch has your report. Sending is <span className="text-slate-200">not</span> a
                    confirmation that a responder is moving — for immediate danger, call 112.
                  </p>
                  <span className="mt-2 rounded-lg border border-slate-700 px-3 py-2 text-[11px] text-slate-300">
                    Save this reference to check the status later
                  </span>
                </div>
              )}
              {step === 3 && (
                <div className="flex flex-col gap-2.5" data-testid="phone-screen-track">
                  <h4 className="font-heading text-base font-bold">Status timeline</h4>
                  {[
                    ["Report received", "Just now", true],
                    ["Acknowledged by operator", "1 min", true],
                    ["Unit assigned · AMB-12 (sample)", "3 min", true],
                    ["En route (simulated)", "—", false],
                  ].map(([label, time, done], i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`mt-1 grid h-4 w-4 place-items-center rounded-full border text-[9px] ${done ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-slate-600 text-slate-500"}`}>
                        {done ? "✓" : ""}
                      </span>
                      <div className="flex-1 text-[12px]">
                        <div className="text-slate-200">{label}</div>
                        <div className="text-[10px] text-slate-500">{time}</div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-[12px] text-slate-300">
                    Reply from Command Centre: "AMB-12 assigned. Keep the person still." <span className="text-[10px] text-slate-500">· sample</span>
                  </div>
                  <span className="mt-auto flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2.5 text-[12px] text-slate-300 justify-center">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Nearby facilities (where data exists)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-500">Interactive preview · the real app is at /app</p>
      </div>
    </div>
  );
}
