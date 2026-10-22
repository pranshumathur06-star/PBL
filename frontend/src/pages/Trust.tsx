import { Link } from "react-router-dom";
import {
  CheckCircle2, CircleDashed, ShieldAlert, PhoneCall, Cookie, MapPin, Scale, FileClock, Lock, ExternalLink,
} from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead } from "@/components/site/ui";

const QUADRANTS = [
  {
    icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50/60", iconTone: "text-emerald-600", title: "Working in this demonstration",
    items: [
      "Guest & citizen reporting with server-side validation and persistence (MongoDB)",
      "Command Centre queue, triage, eligible assignment and the full status machine",
      "Dijkstra shortest-path routing on the 120-node sample Dehradun graph",
      "Citizen status timeline, reply thread and guest follow-up by reference code",
      "Role-based staff auth: httpOnly cookie sessions, PBKDF2-hashed passwords, server-enforced permissions",
      "Audit ledger with actor, role, reason and before/after values",
    ],
  },
  {
    icon: CircleDashed, tone: "border-amber-200 bg-amber-50/60", iconTone: "text-amber-600", title: "Simulated capabilities",
    items: [
      "Unit movement, arrival and 'en route' progress — clearly labelled whenever shown",
      "Travel-time estimates (assumed ~21 km/h average, no live traffic)",
      "Sample incidents, units and audit entries (SAMPLE-101…108, 'System (sample)')",
      "SMS verification codes: the registration code is shown in the app instead of being texted",
      "Command Centre 'live map' — an original illustrative graph, not a real-time map",
    ],
  },
  {
    icon: ExternalLink, tone: "border-slate-200 bg-white", iconTone: "text-slate-500", title: "Planned integrations",
    items: [
      "112 / 108 integration — real escalation to India's emergency lines",
      "Real responder telemetry (GPS from units, with stale-location warnings)",
      "Traffic-aware travel times from a routing provider",
      "Real SMS / notification delivery",
      "District-level multi-tenancy with per-jurisdiction data isolation",
    ],
  },
  {
    icon: Lock, tone: "border-slate-200 bg-white", iconTone: "text-slate-500", title: "Requirements for production",
    items: [
      "A hardened deployment: HTTPS-only cookies, rate limiting at the edge, secret management",
      "Government / 112 operator integration agreements — none exist today, none are claimed",
      "Independent security review before any real citizen data is accepted",
      "Data-protection compliance for location and identity data",
      "Operations run by trained emergency-services staff, not students",
    ],
  },
];

const SAFEGUARDS = [
  {
    icon: PhoneCall, t: "Guest reporting is sacred",
    b: "No account, OTP, GPS, photo or payment is ever required to submit a report. Nothing in the flow can reject, suppress or delay a report because it is anonymous or incomplete.",
  },
  {
    icon: MapPin, t: "Location is opt-in and minimal",
    b: "Manual address works alone. GPS is requested only when the citizen taps for it, accuracy is shown honestly, and reports store at most one point — no tracking.",
  },
  {
    icon: Scale, t: "Risk ≠ fraud verdict",
    b: "Duplicate wording and submission bursts surface as review signals. Severity and suspicion are stored separately; a flagged report stays fully visible in the queue.",
  },
  {
    icon: Cookie, t: "Authentication, stated plainly",
    b: "Sessions are httpOnly cookies backed by a database; passwords are PBKDF2-hashed server-side. This is a reasonable demo baseline — it is not presented as production-grade identity infrastructure.",
  },
  {
    icon: FileClock, t: "Auditability",
    b: "Every consequential operator action — acknowledge, prioritise, assign, flag, review, resolve, reopen, role changes — writes actor, role, reason and before/after values.",
  },
  {
    icon: ShieldAlert, t: "What we will never claim",
    b: "No invented certifications, government partnerships, deployments, testimonials, success rates or emergency statistics. Metrics on this site count things that verifiably exist in the project.",
  },
];

export default function Trust() {
  return (
    <div className="bg-[#F8FAFC]">
      <SiteNav />

      <section className="relative overflow-hidden bg-ease-navy pt-36 pb-20 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <Container className="relative">
          <SectionHead
            dark
            eyebrow="Trust, safety & transparency"
            title="The boundaries, written down."
            sub="EASE is a student-built project demonstration. This page states exactly what works, what is simulated, what is planned and what production would require — with no fine print."
          />
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200" data-testid="trust-demo-banner">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            Unless a real production deployment is explicitly established, everything you see
            here is a demonstration on sample data — including the Command Centre.
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <div className="grid gap-5 lg:grid-cols-2">
            {QUADRANTS.map((q, i) => (
              <Reveal key={q.title} delay={(i % 2) * 100}>
                <div className={`h-full rounded-2xl border p-7 ${q.tone}`} data-testid={`trust-quadrant-${i}`}>
                  <h3 className={`flex items-center gap-2 font-heading text-base font-bold ${i < 2 ? "text-slate-900" : "text-slate-900"}`}>
                    <q.icon className={`h-5 w-5 ${q.iconTone}`} aria-hidden="true" />{q.title}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {q.items.map((it) => (
                      <li key={it} className="flex gap-2.5 text-[13.5px] leading-relaxed text-slate-700">
                        <q.icon className={`mt-0.5 h-4 w-4 shrink-0 ${q.iconTone}`} aria-hidden="true" />{it}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-20">
        <Container>
          <Reveal>
            <SectionHead
              eyebrow="Safeguards in detail"
              title="How the demo protects the person reporting."
              sub="The rules below are enforced in backend code — not just in this page's copy."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAFEGUARDS.map((s, i) => (
              <Reveal key={s.t} delay={(i % 3) * 90}>
                <div className="h-full rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-ease-blue">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-slate-900">{s.t}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{s.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={180}>
            <div className="mt-12 rounded-2xl border border-red-200 bg-[#FFF5F5] p-6 text-sm leading-relaxed text-slate-700">
              <strong className="text-slate-900">The 112 rule.</strong> Nothing in EASE replaces
              India's emergency number. Every page keeps 112 one tap away, and the citizen flow
              says plainly that sending a report is not a responder being dispatched.
            </div>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
