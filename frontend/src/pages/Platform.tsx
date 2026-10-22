import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CircleDashed, MapPin, UserCheck, Route as RouteIcon, ShieldCheck, Clock3 } from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead, DemoLabel } from "@/components/site/ui";
import FlowDiagram from "@/components/viz/FlowDiagram";

const PILLARS = [
  {
    icon: MapPin, title: "Location intelligence",
    body: "Manual addresses, landmarks and PINs are first-class; GPS coordinates are optional and never blocking. Reports snap to the nearest node on the 120-node sample road graph so routing has something truthful to work with.",
  },
  {
    icon: UserCheck, title: "Incident prioritisation",
    body: "Life-threatening reports are always Critical. Everything else is triaged by a transparent keyword heuristic — and an operator can raise or lower priority with a reason that is recorded.",
  },
  {
    icon: ShieldCheck, title: "Responder suitability",
    body: "Assignments are gated by service type: medical needs an ambulance, fire needs an engine, theft needs police. The backend rejects ineligible units rather than trusting the UI.",
  },
  {
    icon: UserCheck, title: "Human oversight",
    body: "Risk signals — duplicates, bursts, test wording — inform review but never auto-reject. Severity and suspected fraud are kept deliberately separate: an anonymous report is still an emergency.",
  },
  {
    icon: RouteIcon, title: "Routing you can interrogate",
    body: "The exact shortest path, node coverage and computation time are returned with every route — the algorithm is a fact, the travel time is an honest estimate.",
  },
  {
    icon: Clock3, title: "Auditability",
    body: "Acknowledge, prioritise, assign, flag, resolve, close, reopen — every consequential action records actor, role, reason and before/after values in an immutable ledger.",
  },
];

const CURRENT = [
  "Guest & citizen reporting with validation",
  "Command Centre queue, triage & assignment",
  "Dijkstra routing on the sample graph",
  "Citizen status timeline & replies",
  "Role-based staff auth (cookie sessions)",
  "Full audit ledger",
];

const PLANNED = [
  ["112 / 108 integration", "India's emergency numbers would be the real escalation path; EASE reports would supplement, never replace, a 112 call."],
  ["Real unit telemetry", "Live GPS from responder devices, with freshness indicators and stale-location warnings."],
  ["Live traffic-aware routing", "Travel-time estimates from a real traffic feed instead of the assumed ~21 km/h average."],
  ["SMS & notifications", "Real OTP delivery and status notifications through a messaging gateway."],
  ["Multi-tenancy", "District-level isolation of incidents, units and audit history per jurisdiction."],
];

export default function Platform() {
  return (
    <div className="bg-[#F8FAFC]">
      <SiteNav />

      <section className="relative overflow-hidden bg-ease-navy pt-36 pb-20 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-ease-blue/20 blur-[120px]" aria-hidden="true" />
        <Container className="relative">
          <SectionHead
            dark
            eyebrow="Platform overview"
            title={<>One connected flow from <span className="text-ease-sky">report to resolution</span>.</>}
            sub="EASE is one pipeline: a citizen's report becomes structured context, context becomes a prioritised queue item, a human decision becomes an assigned, routed, tracked response — and everything is auditable afterwards."
          />
          <div className="mt-6"><DemoLabel>Live demo pipeline — sample data</DemoLabel></div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <Reveal>
            <FlowDiagram />
          </Reveal>
        </Container>
      </section>

      <section className="bg-white py-20">
        <Container>
          <Reveal>
            <SectionHead
              eyebrow="What the system does"
              title="Six jobs, done honestly."
              sub="These are the actual capabilities implemented in this build — not a wish list."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={(i % 3) * 90}>
                <div className="group h-full rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition-colors hover:border-ease-blue/40 hover:bg-white hover:shadow-[0_16px_40px_rgba(37,99,235,0.08)]">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-ease-blue transition-colors group-hover:bg-ease-blue group-hover:text-white">
                    <p.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-slate-900">{p.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <Reveal>
            <SectionHead
              eyebrow="Honesty by architecture"
              title="Current functionality vs. planned integrations."
              sub="The left column is implemented and testable in this deployment. The right column needs real infrastructure and partners — we won't pretend otherwise."
            />
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-emerald-200 bg-white p-7 shadow-sm">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" /> Working in this build
                </h3>
                <ul className="mt-4 flex flex-col gap-3 text-sm text-slate-700">
                  {CURRENT.map((c) => (
                    <li key={c} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />{c}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold text-slate-900">
                  <CircleDashed className="h-5 w-5 text-slate-400" aria-hidden="true" /> Planned integrations
                </h3>
                <ul className="mt-4 flex flex-col gap-3.5">
                  {PLANNED.map(([t, b]) => (
                    <li key={t} className="flex gap-2.5">
                      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="text-sm text-slate-700"><strong className="font-semibold text-slate-900">{t}.</strong> {b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link to="/command-centre" className="inline-flex items-center gap-2 rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8]">
                See it in operations <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/intelligence" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-ease-blue hover:text-ease-blue">
                Dive into the routing engine
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
