import { Link } from "react-router-dom";
import {
  ArrowRight, PhoneCall, Siren, ClipboardCheck, Route as RouteIcon, History, ShieldCheck,
  ShieldAlert, Smartphone, LayoutDashboard, CheckCircle2, CircleDashed, ChevronRight, MapPin,
} from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import CountUp from "@/components/site/CountUp";
import { Container, SectionHead, DemoLabel } from "@/components/site/ui";
import IncidentPipeline from "@/components/viz/IncidentPipeline";
import FlowDiagram from "@/components/viz/FlowDiagram";
import DijkstraMap from "@/components/viz/DijkstraMap";
import SceneVideo from "@/components/site/SceneVideo";

const JOURNEY = [
  { icon: Siren, title: "Report", body: "A citizen describes the situation — guest or signed-in, no OTP, no photo required." },
  { icon: ClipboardCheck, title: "Review", body: "An operator acknowledges, prioritises and records the reason. A human decides." },
  { icon: RouteIcon, title: "Route", body: "Dijkstra's algorithm finds the shortest path over the sample Dehradun road graph." },
  { icon: PhoneCall, title: "Assign", body: "An eligible unit — ambulance, fire, police or mechanic — is dispatched with one audited action." },
  { icon: History, title: "Track & audit", body: "Status updates reach the citizen timeline; every decision lands in the audit ledger." },
];

const SCENES = [
  {
    key: "ambulance", src: "/media/scene-ambulance.mp4", alt: "Stock footage of an emergency vehicle crew on the move",
    stage: "Respond", title: "The crew on the road",
    body: "In EASE, the right unit is picked by service type and the shortest path to the incident is worked out, then the assignment is logged.",
  },
  {
    key: "fire", src: "/media/scene-fire.mp4", alt: "Stock footage of a fire truck at night",
    stage: "Match the service", title: "The right unit for the call",
    body: "Fire and flood reports go to fire units; medical to ambulances; crime to police. The backend rejects a mismatch.",
  },
  {
    key: "control", src: "/media/scene-control-room.mp4", alt: "Stock footage of operators working in a control room",
    stage: "Decide", title: "The room making the calls",
    body: "Operators review, prioritise and assign from one queue — and every decision lands in the audit log.",
  },
];

const WORKING = [
  "Guest & citizen reporting with a real backend",
  "Command Centre queue, assignment & status machine",
  "Dijkstra shortest-path routing (sample graph)",
  "Role-based staff access with audited actions",
];

const SIMULATED = [
  "Unit movement and arrival",
  "Live traffic, travel time & live GPS",
  "Connection to India's 112 / 108 services",
  "SMS delivery of verification codes",
];

export default function Home() {
  return (
    <div className="bg-[#F8FAFC]">
      <SiteNav />

      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden bg-ease-navy pt-36 pb-20 lg:pt-44 lg:pb-28">
        {/* Licensed stock footage (Pexels free licence) — an ambulance on a city street. Not a real incident. */}
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-45 motion-reduce:hidden"
          src="/media/hero-ambulance.mp4"
          autoPlay muted loop playsInline preload="metadata"
          aria-hidden="true"
          data-testid="hero-bg-video"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ease-navy via-ease-navy/85 to-ease-navy/40" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ease-navy to-transparent" aria-hidden="true" />
        <span className="absolute bottom-3 left-4 z-10 rounded bg-black/50 px-2 py-0.5 text-[10.5px] text-slate-400" data-testid="hero-video-credit">
          Stock footage via Pexels · illustrative, not a real incident
        </span>
        <div className="grid-bg anim-grid absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#1D4ED8]/25 blur-[140px]" aria-hidden="true" />
        <div className="absolute right-[8%] top-[30%] h-40 w-40 rounded-full border-2 border-ease-sky/20 anim-ping hidden lg:block" aria-hidden="true" />
        <Container className="relative">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-ease-red anim-blink" aria-hidden="true" />
                  Emergency Assistance &amp; Smart Escalation
                </span>
              </Reveal>
              <Reveal delay={90}>
                <h1 className="mt-6 font-heading text-[2.6rem] font-extrabold leading-[1.06] text-white sm:text-6xl" data-testid="hero-headline">
                  When Every Second Matters,{" "}
                  <span className="bg-gradient-to-r from-ease-sky to-[#7DD3FC] bg-clip-text text-transparent">Clarity Changes Everything.</span>
                </h1>
              </Reveal>
              <Reveal delay={180}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
                  EASE connects emergency reports, location intelligence, and human-led response
                  coordination in one unified platform.
                </p>
              </Reveal>
              <Reveal delay={260}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to="/platform"
                    data-testid="hero-cta-explore"
                    className="inline-flex items-center gap-2 rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white shadow-[0_12px_36px_rgba(37,99,235,0.4)] transition hover:bg-[#1D4ED8]"
                  >
                    Explore EASE <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/command-centre"
                    data-testid="hero-cta-command"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-ease-sky/60 hover:text-white"
                  >
                    Explore the Command Centre
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={330}>
                <p className="mt-6 flex max-w-xl items-start gap-2 text-[13px] leading-relaxed text-slate-500">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                  <span>
                    Demonstration platform — not connected to any emergency service. In a real
                    emergency in India, call <a href="tel:112" data-testid="hero-112-link" className="font-bold text-slate-300 underline underline-offset-2">112</a>.
                  </span>
                </p>
              </Reveal>
            </div>
            <Reveal delay={200}>
              <IncidentPipeline />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------------- capability strip (verified, in-project metrics) ---------------- */}
      <section className="border-b border-slate-200 bg-white">
        <Container>
          <div className="grid grid-cols-2 gap-6 py-10 text-center sm:grid-cols-4">
            {[
              { to: 120, label: "road-graph nodes in the routing demo", test: "metric-nodes" },
              { to: 156, label: "sample road segments connected", test: "metric-edges" },
              { to: 8, label: "emergency categories triaged", test: "metric-categories" },
              { to: 112, label: "India emergency fallback, always one tap away", test: "metric-112" },
            ].map((m) => (
              <Reveal key={m.label}>
                <div className="stat">
                  <div className="font-data text-3xl font-extrabold text-slate-900 sm:text-4xl" data-testid={m.test}>
                    <CountUp to={m.to} />
                  </div>
                  <div className="mt-1.5 text-[12.5px] leading-snug text-slate-500">{m.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ---------------- scene video strip (licensed stock footage) ---------------- */}
      <section className="bg-ease-navy py-20 lg:py-24" data-testid="scene-strip">
        <Container>
          <Reveal>
            <SectionHead
              dark
              eyebrow="The people EASE is built for"
              title="Every report ends with a crew on the move — and a room making the calls."
              sub="Ambulance teams, fire crews and control-room operators are the people a coordination platform has to serve. These clips are stock footage, shown for illustration only."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-[1.25fr_1fr] md:grid-rows-2">
            {SCENES.map((s, i) => (
              <Reveal key={s.key} delay={i * 120} className={i === 0 ? "md:row-span-2" : ""}>
                <figure className="group relative h-full overflow-hidden rounded-2xl border border-ease-line" data-testid={`scene-${s.key}`}>
                  <SceneVideo src={s.src} label={s.alt} testId={`scene-video-${s.key}`} className={i === 0 ? "h-72 md:h-full md:min-h-[460px]" : "h-56 md:h-full md:min-h-[220px]"} />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ease-navy via-ease-navy/30 to-transparent" aria-hidden="true" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-5">
                    <span className="font-data text-[10.5px] font-bold uppercase tracking-[0.2em] text-ease-sky">{s.stage}</span>
                    <h3 className="mt-1.5 font-heading text-lg font-bold text-white">{s.title}</h3>
                    <p className="mt-1 max-w-md text-[13px] leading-relaxed text-slate-300">{s.body}</p>
                  </figcaption>
                  <span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-0.5 text-[10px] text-slate-300">Stock footage · Pexels</span>
                </figure>
              </Reveal>
            ))}
          </div>
          <p className="mt-5 text-[11.5px] text-slate-500">Illustrative stock footage (Pexels free licence). Not EASE deployments, not real incidents, and not footage from Dehradun.</p>
        </Container>
      </section>

      {/* ---------------- problem / solution storytelling ---------------- */}
      <section className="py-20 lg:py-28">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-32">
              <SectionHead
                eyebrow="The first ten minutes"
                title={<>Emergencies are chaotic. <span className="text-ease-blue">Coordination shouldn't be.</span></>}
                sub="In the minutes that matter most, information is scattered across calls, memories and guesswork. EASE gives citizens one low-friction way to report, and operators one clear picture to act on."
              />
              <Reveal delay={150}>
                <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm leading-relaxed text-slate-600">
                    "Every dropped detail — an unclear address, an unlogged decision, a
                    duplicate nobody noticed — costs minutes. EASE is built so that nothing
                    important depends on memory."
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">The problem EASE works on</p>
                </div>
              </Reveal>
            </div>
            <div className="flex flex-col gap-5">
              {[
                { icon: Siren, t: "Reporting is friction", b: "Long forms and mandatory sign-ups cost minutes nobody has. EASE's citizen flow is three screens with zero required accounts.", tone: "problem" },
                { icon: ClipboardCheck, t: "Triage is guesswork", b: "Severity decided by whoever shouts loudest is not triage. EASE structures urgency, category and location into one prioritised queue.", tone: "solution" },
                { icon: RouteIcon, t: "Routing is opaque", b: "Rather than hand-waving 'the nearest unit', EASE computes and shows a true shortest path over its sample road graph — distance labelled honestly.", tone: "solution" },
                { icon: History, t: "Decisions evaporate", b: "Who assigned what, why, and what changed — EASE writes it all to an audit ledger with actor, reason and before/after values.", tone: "solution" },
              ].map((c, i) => (
                <Reveal key={c.t} delay={i * 90}>
                  <div className={`flex gap-4 rounded-2xl border p-6 ${c.tone === "problem" ? "border-red-100 bg-[#FFF5F5]" : "border-slate-200 bg-white shadow-sm"}`}>
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${c.tone === "problem" ? "bg-red-50 text-ease-red" : "bg-blue-50 text-ease-blue"}`}>
                      <c.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-heading text-base font-bold text-slate-900">{c.t}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.b}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- platform overview ---------------- */}
      <section className="bg-ease-navy py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHead
              dark
              eyebrow="The platform"
              title="One flow from a trembling report to an audited outcome."
              sub="Click through the stages — every step below runs in the live demo."
            />
          </Reveal>
          <Reveal delay={150} className="mt-12">
            <FlowDiagram />
          </Reveal>
        </Container>
      </section>

      {/* ---------------- citizen app ---------------- */}
      <section className="py-20 lg:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <div className="relative mx-auto w-fit">
                <div className="w-[260px] rounded-[36px] border border-slate-300 bg-slate-900 p-2.5 shadow-[0_30px_70px_rgba(2,8,23,0.25)]">
                  <div className="rounded-[28px] bg-[#0F172A] p-5 text-white">
                    <div className="flex items-center justify-between text-[10px] text-slate-400"><span>9:41</span><span>EASE Citizen</span></div>
                    <div className="mt-5 rounded-xl bg-ease-red py-6 text-center">
                      <Siren className="mx-auto h-7 w-7" aria-hidden="true" />
                      <p className="mt-2 text-sm font-bold">Report an emergency</p>
                      <p className="mt-1 text-[10.5px] text-red-200">No sign-in required</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {["Medical", "Fire", "Accident"].map((c) => (
                        <span key={c} className="rounded-lg border border-slate-700 py-2 text-center text-[10.5px] text-slate-300">{c}</span>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-700 px-3 py-2.5 text-[11px] text-slate-400">
                      <MapPin className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />Rajpur Road, Dehradun · PIN 248001
                    </div>
                  </div>
                </div>
                <div className="absolute -right-6 -top-6 rotate-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs shadow-lg">
                  <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-500" aria-hidden="true" />Report received · RPT-…
                </div>
              </div>
            </Reveal>
            <div>
              <Reveal>
                <SectionHead
                  eyebrow="For citizens"
                  title="Help, without the hoops."
                  sub="The EASE Citizen App is built around one promise: nothing between a person in trouble and a clear report — no account, no OTP, no GPS, no photo."
                />
                <ul className="mt-7 flex flex-col gap-3 text-sm text-slate-600">
                  {[
                    "Six emergency categories with plain-language guidance",
                    "Manual address entry first; GPS optional and never blocking",
                    "A reference code and live status timeline for every report",
                    "Guest reporting for signed-out users, history for signed-in",
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />{li}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/citizen" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800" data-testid="home-citizen-cta">
                    <Smartphone className="h-4 w-4" aria-hidden="true" /> Discover the Citizen App
                  </Link>
                  <Link to="/app" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-ease-blue hover:text-ease-blue">
                    Open the live app <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- command centre ---------------- */}
      <section className="bg-ease-panel py-20 lg:py-28">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <Reveal>
                <SectionHead
                  dark
                  eyebrow="For operations"
                  title="A cockpit for the people who decide."
                  sub="The EASE Command Centre gives dispatchers a priority queue, a live sample map, eligible-unit assignment and an audit ledger — keyboard-first, no decoration."
                />
                <ul className="mt-7 flex flex-col gap-3 text-sm text-slate-400">
                  {[
                    "Severity-first queue with filters and search",
                    "One-action assignment with shortest-path preview",
                    "Risk signals that inform review, never auto-reject",
                    "Every action audited with reason and before/after",
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ease-sky" aria-hidden="true" />{li}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/command-centre" className="inline-flex items-center gap-2 rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8]" data-testid="home-ops-cta">
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> See the Command Centre
                  </Link>
                </div>
              </Reveal>
            </div>
            <Reveal delay={140}>
              <div className="overflow-hidden rounded-2xl border border-ease-line bg-ease-card">
                <div className="flex items-center justify-between border-b border-ease-line px-4 py-2.5">
                  <span className="text-xs text-slate-400">Incident queue · sample</span>
                  <DemoLabel />
                </div>
                <div className="flex flex-col divide-y divide-ease-line/60">
                  {[
                    ["SAMPLE-101", "Critical", "bg-red-500/15 text-red-300 border-red-500/40", "Elderly person with chest pain", "Rajpur Road area"],
                    ["SAMPLE-103", "Critical", "bg-red-500/15 text-red-300 border-red-500/40", "Kitchen smoke, residents leaving", "Patel Nagar area"],
                    ["SAMPLE-105", "High", "bg-amber-500/15 text-amber-300 border-amber-500/40", "Water entering ground-floor shops", "Graphic Era side"],
                  ].map(([code, sev, tone, text, area]) => (
                    <div key={code as string} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03]">
                      <span className={`rounded border px-1.5 text-[10px] font-bold ${tone}`}>{sev}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] text-slate-200">{text}</div>
                        <div className="text-[11px] text-slate-500">{area}</div>
                      </div>
                      <span className="font-data text-[11px] text-slate-500">{code}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------------- journey ---------------- */}
      <section className="py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHead
              center
              eyebrow="The journey"
              title="Five moves from chaos to coordination."
              sub="This is the exact lifecycle every report travels in the working demo."
            />
          </Reveal>
          <div className="relative mt-14">
            <div className="absolute left-0 right-0 top-6 hidden border-t-2 border-dashed border-slate-200 lg:block" aria-hidden="true" />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
              {JOURNEY.map((j, i) => (
                <Reveal key={j.title} delay={i * 100}>
                  <div className="relative" data-testid={`home-journey-${i}`}>
                    <span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-ease-blue shadow-sm">
                      <j.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-heading text-base font-bold text-slate-900">{i + 1}. {j.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{j.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={200}>
            <p className="mt-10 text-center">
              <Link to="/how-it-works" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ease-blue hover:underline">
                Walk through the full seven-step lifecycle <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
          </Reveal>
        </Container>
      </section>

      {/* ---------------- interactive showcase: routing ---------------- */}
      <section className="bg-white py-20 lg:py-28">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <Reveal>
              <SectionHead
                eyebrow="Try it here"
                title="Shortest path, computed live."
                sub="Pick any two facilities — the real Dijkstra implementation behind the Command Centre computes the route over the sample Dehradun graph and returns distance, node coverage and compute time."
              />
              <ul className="mt-6 flex flex-col gap-2 text-[13px] text-slate-600">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />True algorithmic result, measured server-side</li>
                <li className="flex gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />Time estimates are assumptions, not live traffic</li>
              </ul>
            </Reveal>
            <Reveal delay={140}>
              <DijkstraMap />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* ---------------- trust strip ---------------- */}
      <section className="py-20">
        <Container>
          <Reveal>
            <SectionHead
              center
              eyebrow="Honest by design"
              title="You always know what's real."
              sub="Every screen separates working functionality from simulation. No invented statistics, no pretend dispatches, no fake partnerships."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-emerald-200 bg-emerald-50/50 p-7">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Working in this demo
                </h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm text-emerald-900/80">
                  {WORKING.map((w) => <li key={w} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />{w}</li>)}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="h-full rounded-2xl border border-amber-200 bg-amber-50/50 p-7">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold text-amber-900">
                  <CircleDashed className="h-5 w-5 text-amber-600" aria-hidden="true" /> Simulated or not yet connected
                </h3>
                <ul className="mt-4 flex flex-col gap-2.5 text-sm text-amber-900/80">
                  {SIMULATED.map((w) => <li key={w} className="flex gap-2"><CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />{w}</li>)}
                </ul>
              </div>
            </Reveal>
          </div>
          <Reveal delay={180}>
            <p className="mt-8 text-center">
              <Link to="/trust" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ease-blue hover:underline" data-testid="home-trust-link">
                Read the full trust & transparency report <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
          </Reveal>
        </Container>
      </section>

      {/* ---------------- final CTA ---------------- */}
      <section className="pb-20">
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#B91230] via-ease-red to-[#7F1D1D] px-8 py-16 text-center shadow-[0_30px_80px_rgba(225,29,72,0.25)] sm:px-16">
              <div className="grid-bg anim-grid absolute inset-0 opacity-40" aria-hidden="true" />
              <div className="relative">
                <h2 className="mx-auto max-w-2xl font-heading text-3xl font-extrabold text-white sm:text-4xl">
                  See a report travel the whole road.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-red-100">
                  File a sample report as a guest, watch it hit the Command Centre queue, assign
                  a unit along its shortest path — then read the audit trail it left behind.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/app" data-testid="home-final-cta-app" className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-ease-red transition hover:bg-red-50">
                    Report as a guest
                  </Link>
                  <Link to="/ops" data-testid="home-final-cta-ops" className="rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                    Open the Command Centre
                  </Link>
                </div>
                <p className="mt-6 text-[11.5px] text-red-200/90">
                  <a href="tel:112" className="font-bold text-white underline">Call 112</a> in a real emergency — EASE is a demonstration, never a substitute.
                </p>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
