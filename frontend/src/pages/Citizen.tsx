import { Link } from "react-router-dom";
import {
  ArrowRight, PhoneCall, Siren, MapPin, WifiOff, FileText, History, ShieldCheck, CheckCircle2, ChevronRight,
} from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead } from "@/components/site/ui";
import PhoneSim from "@/components/viz/PhoneSim";

const FEATURES = [
  { icon: Siren, t: "Quick emergency reporting", b: "One red action, three screens, plain words. Built for the worst minute of someone's day." },
  { icon: FileText, t: "Categories that guide you", b: "Medical, accident, fire, crime, flood and more — each with plain-language safety guidance while you wait." },
  { icon: MapPin, t: "Location, your way", b: "Manual address and landmark first. GPS optional, with an accuracy read-out and a graceful fallback." },
  { icon: WifiOff, t: "Offline-tolerant mindset", b: "Weak GPS or no connection never blocks a report — the flow degrades to what always works: words and an address." },
  { icon: History, t: "Status you can see", b: "A reference code plus a live timeline: acknowledged, under review, unit assigned — with a reply thread." },
  { icon: ShieldCheck, t: "Guest first", b: "Reporting works without an account. Signing in only adds history and saved details — never a gate." },
];

export default function Citizen() {
  return (
    <div className="bg-[#F8FAFC]">
      <SiteNav />

      {/* product hero */}
      <section className="relative overflow-hidden bg-ease-navy pt-36 pb-20 lg:pt-44 lg:pb-24">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 left-[10%] h-80 w-80 rounded-full bg-ease-red/20 blur-[110px]" aria-hidden="true" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-slate-300">
                  EASE Citizen · public-facing app
                </span>
              </Reveal>
              <Reveal delay={90}>
                <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl">
                  Three screens between <span className="text-ease-sky">a person and help.</span>
                </h1>
              </Reveal>
              <Reveal delay={170}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
                  The Citizen App is the front door of EASE: describe the emergency, confirm
                  where you are, send it — then watch the response unfold on a live timeline.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/app" data-testid="citizen-open-app-cta" className="inline-flex items-center gap-2 rounded-xl bg-ease-red px-5 py-3 text-sm font-bold text-white shadow-[0_12px_36px_rgba(225,29,72,0.4)] transition hover:bg-[#BE123C]">
                    <Siren className="h-4 w-4" aria-hidden="true" /> Open the live app
                  </Link>
                  <a href="tel:112" className="inline-flex items-center gap-2 rounded-xl border border-red-400/50 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-100 transition hover:bg-red-500/20">
                    <PhoneCall className="h-4 w-4" aria-hidden="true" /> Call 112 instead
                  </a>
                </div>
              </Reveal>
              <Reveal delay={300}>
                <p className="mt-6 text-[13px] leading-relaxed text-slate-500">
                  Guest reporting needs no account. For immediate danger, always call{" "}
                  <strong className="text-slate-300">112</strong> — a website report is never a
                  substitute for the emergency line.
                </p>
              </Reveal>
            </div>
            <Reveal delay={160}>
              <div className="rounded-2xl border border-ease-line bg-ease-panel p-6">
                <h3 className="font-heading text-sm font-bold text-white">What the flow guarantees</h3>
                <ul className="mt-4 flex flex-col gap-3 text-[13px] text-slate-300">
                  {[
                    "No OTP, account, GPS or photo required to report",
                    "Life-danger flag is always treated as Critical",
                    "Sending is never shown as a responder en route",
                    "Every report gets a followable reference code",
                  ].map((li) => (
                    <li key={li} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />{li}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* features */}
      <section className="py-20">
        <Container>
          <Reveal>
            <SectionHead
              eyebrow="Features"
              title="Small decisions that respect panic."
              sub="Everything in the citizen flow is designed so the fastest path is also the clearest one."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={(i % 3) * 90}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-ease-blue/40">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-ease-blue">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-slate-900">{f.t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{f.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* scroll walkthrough */}
      <section className="bg-white py-20">
        <Container>
          <Reveal>
            <SectionHead
              eyebrow="Walkthrough"
              title="Scroll through a report's journey."
              sub="This preview mirrors the real flow. The live app is one click away — no decoration, no screenshots."
            />
          </Reveal>
          <Reveal delay={140} className="mt-14">
            <PhoneSim />
          </Reveal>
        </Container>
      </section>

      {/* 112 callout */}
      <section className="py-20">
        <Container>
          <Reveal>
            <div className="rounded-3xl border border-red-200 bg-[#FFF5F5] p-8 sm:p-12">
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ease-red text-white">
                  <PhoneCall className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <h2 className="font-heading text-2xl font-extrabold text-slate-900">In India, 112 is the real lifeline.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                    EASE is a demonstration platform. It has no connection to India's emergency
                    services, so a report here does not alert an ambulance, fire crew or police.
                    If a life is in danger, call <strong>112</strong> first — then, if it helps,
                    file an EASE report to see the coordination workflow.
                  </p>
                </div>
                <a href="tel:112" className="shrink-0 rounded-xl bg-ease-red px-6 py-3.5 text-base font-extrabold text-white transition hover:bg-[#BE123C]" data-testid="citizen-112-cta">
                  Call 112
                </a>
              </div>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-10 text-center">
              <Link to="/app" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ease-blue hover:underline">
                Try the actual reporting flow <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
