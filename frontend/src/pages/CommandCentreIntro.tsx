import { Link } from "react-router-dom";
import {
  ArrowRight, Keyboard, ListFilter, Map as MapIcon, Siren, ShieldAlert, History, Users, Radar,
} from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead } from "@/components/site/ui";
import CommandPreview from "@/components/viz/CommandPreview";

const CAPABILITIES = [
  { icon: ListFilter, t: "Priority incident queue", b: "Severity-first ordering with category, status and free-text filters. Newest critical always at the top." },
  { icon: Radar, t: "Severity & status at a glance", b: "Life-threatening reports are Critical — colour and icon encode the state machine the moment you look at the queue." },
  { icon: MapIcon, t: "Incident location map", b: "The sample Dehradun graph shows the incident, the unit's base and the computed shortest path between them." },
  { icon: Siren, t: "Assignment & reassignment", b: "One audited action assigns an eligible unit; reassignment releases the previous unit automatically." },
  { icon: ShieldAlert, t: "Human-reviewed risk signals", b: "Duplicates, bursts and test wording are signals to inform review — severity and fraud suspicion stay separate." },
  { icon: History, t: "Timelines & audit records", b: "Every incident carries a status history; every operator action lands in the ledger with reason and before/after values." },
];

const ROLES = [
  ["Dispatcher", "Acknowledge, review, prioritise, note, assign, link, resolve, flag — the operational core."],
  ["Supervisor", "Everything a dispatcher does, plus escalation review and reopening closed incidents."],
  ["Admin", "Full access including user & role management — with last-admin protection enforced server-side."],
  ["Read-only analyst", "Sees the live picture, changes nothing. Enforced by the backend, not by hidden buttons."],
];

export default function CommandCentreIntro() {
  return (
    <div className="bg-ease-navy">
      <SiteNav />

      {/* hero */}
      <section className="relative overflow-hidden pt-36 pb-16 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 right-[15%] h-96 w-96 rounded-full bg-ease-blue/20 blur-[120px]" aria-hidden="true" />
        <Container className="relative">
          <div className="max-w-3xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-slate-300">
                EASE Command Centre · for operations teams
              </span>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl" data-testid="ops-hero-headline">
                The room where <span className="text-ease-sky">minutes are decided.</span>
              </h1>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-6 text-lg leading-relaxed text-slate-400">
                A desktop-first operational console — priority queue, live sample map, eligible
                assignment and an audit ledger. Built for speed, readability and decisions you
                can defend afterwards.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/ops" data-testid="ops-open-cta" className="inline-flex items-center gap-2 rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white shadow-[0_12px_36px_rgba(37,99,235,0.4)] transition hover:bg-[#1D4ED8]">
                  Open Command Centre <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-ease-sky/60 hover:text-white">
                  Staff sign-in
                </Link>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* interactive preview */}
      <section className="pb-20">
        <Container>
          <Reveal>
            <CommandPreview />
          </Reveal>
        </Container>
      </section>

      {/* capabilities */}
      <section className="bg-[#F8FAFC] py-20">
        <Container>
          <Reveal>
            <SectionHead
              eyebrow="Inside the console"
              title="Dense where it helps. Quiet where it matters."
              sub="Operations interfaces win on information architecture, not on decoration — every panel earns its place."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.t} delay={(i % 3) * 90}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-ease-blue/40">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-ease-blue">
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-slate-900">{c.t}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{c.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* roles */}
      <section className="py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <SectionHead
                dark
                eyebrow="Roles & permissions"
                title="Authority with guardrails."
                sub="Permissions are enforced server-side on every request — the UI hides what a role can't do, but hiding is never the only control."
              />
              <div className="mt-8 flex items-start gap-3 rounded-2xl border border-ease-line bg-ease-panel p-5 text-[13px] leading-relaxed text-slate-400">
                <Keyboard className="mt-0.5 h-5 w-5 shrink-0 text-ease-sky" aria-hidden="true" />
                Built keyboard-first: the queue, filters and actions are reachable without a
                mouse, because operators work against the clock.
              </div>
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-[13px] leading-relaxed text-amber-200">
                No real-time GPS, live traffic, live incident feeds or real dispatch are claimed.
                The console runs on the demo database with clearly-labelled sample records.
              </div>
            </Reveal>
            <div className="flex flex-col gap-4">
              {ROLES.map(([r, b], i) => (
                <Reveal key={r} delay={i * 90}>
                  <div className="flex gap-4 rounded-2xl border border-ease-line bg-ease-panel p-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ease-blue/15 text-ease-sky">
                      <Users className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-heading text-sm font-bold text-white">{r}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{b}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* final CTA */}
      <section className="pb-20">
        <Container>
          <Reveal>
            <div className="rounded-3xl border border-ease-line bg-ease-panel p-10 text-center">
              <h2 className="font-heading text-2xl font-extrabold text-white sm:text-3xl">Take the operator's chair.</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                Sign in with a demo dispatcher account (shown on the sign-in page), or explore as
                a read-only analyst to see permissions enforced live.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to="/ops" data-testid="ops-final-cta" className="rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8]">Open Command Centre</Link>
                <Link to="/login" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-ease-sky/60">Go to sign-in</Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
