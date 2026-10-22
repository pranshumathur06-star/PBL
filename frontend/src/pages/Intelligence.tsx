import { ShieldAlert, ShieldCheck, Scale, FileClock, Siren, MapPin, UserCheck } from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead } from "@/components/site/ui";
import DijkstraMap from "@/components/viz/DijkstraMap";

const SIGNALS = [
  { id: "testwords", kind: "Inferred", weight: 30, text: "Wording suggests a test or joke.", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  { id: "burst", kind: "Observed", weight: 30, text: "Several submission attempts within 2 minutes.", tone: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  { id: "duplicate", kind: "Observed", weight: 25, text: "Similar report received recently — possible duplicate.", tone: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
];

const AUDIT = [
  ["A-0128", "Demo Dispatcher (Dispatcher)", "Unit reassigned", "SAMPLE-105", "Original unit offline", "FIRE-04 / Assigned", "FIRE-02 / Assigned"],
  ["A-0127", "Demo Dispatcher (Dispatcher)", "Priority change", "SAMPLE-103", "Medium", "Critical"],
  ["A-0126", "Demo Supervisor (Supervisor)", "Risk review: cleared", "SAMPLE-106", "needs_review=True", "needs_review=False"],
  ["A-0125", "Demo Admin (Admin)", "Role change", "analyst@ease.demo", "Dispatcher", "Read-only analyst"],
];

export default function Intelligence() {
  return (
    <div className="bg-ease-navy">
      <SiteNav />

      <section className="relative overflow-hidden pt-36 pb-16 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 left-[20%] h-96 w-96 rounded-full bg-ease-blue/20 blur-[120px]" aria-hidden="true" />
        <Container className="relative">
          <div className="max-w-3xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-slate-300">
                Intelligence · routing & risk review
              </span>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="mt-6 font-heading text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl">
                Algorithms with <span className="text-ease-sky">their assumptions on the label.</span>
              </h1>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-6 text-lg leading-relaxed text-slate-400">
                Routing, triage and risk review are the technical core of EASE. Each is real,
                inspectable — and honest about what it cannot know.
              </p>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* routing */}
      <section className="pb-20">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <Reveal>
              <DijkstraMap />
            </Reveal>
            <div>
              <Reveal>
                <SectionHead
                  dark
                  eyebrow="Routing & location intelligence"
                  title="Dijkstra, over a sample Dehradun road graph."
                />
                <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-slate-400">
                  <p>
                    EASE carries a 120-node, 156-edge demonstration road graph of Dehradun —
                    with landmarks like Clock Tower, ISBT, Rajpur Road and Doon Hospital. The
                    backend runs Dijkstra's algorithm with a binary min-heap, O((V+E) log V),
                    exactly as the original project did.
                  </p>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <p className="flex gap-2 font-semibold text-emerald-300"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />What's real</p>
                    <p className="mt-1.5 text-slate-300">The shortest-path <strong>distance</strong>, the node coverage and the compute time are genuine algorithmic results you can verify.</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <p className="flex gap-2 font-semibold text-amber-300"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />What's estimated</p>
                    <p className="mt-1.5 text-slate-300">Travel time assumes ~21 km/h average fleet speed. There is no live traffic, no real-time GPS and no guarantee this is the fastest route in the world — only the shortest on this sample graph.</p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </section>

      {/* triage */}
      <section className="border-t border-ease-line bg-ease-panel py-20">
        <Container>
          <Reveal>
            <SectionHead
              dark
              eyebrow="Incident triage"
              title="Priority is structured, then human."
              sub="Triage starts with what the reporter tells us and ends with what an operator decides — both parts are recorded."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              { icon: Siren, t: "Reported urgency", b: "A life-in-danger flag maps directly to Critical — always, before any heuristic touches it." },
              { icon: MapPin, t: "Category & wording", b: "A transparent keyword heuristic (fire, medical, flood keywords weigh heavier) suggests High / Medium / Low for non-life reports." },
              { icon: UserCheck, t: "Operator adjustment", b: "Dispatchers can raise or lower priority with a mandatory-audited reason. The system proposes; a person decides." },
            ].map((c, i) => (
              <Reveal key={c.t} delay={i * 100}>
                <div className="h-full rounded-2xl border border-ease-line bg-ease-card p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-ease-blue/15 text-ease-sky">
                    <c.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-white">{c.t}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-400">{c.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* risk signals */}
      <section className="py-20">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <SectionHead
                dark
                eyebrow="Human-reviewed risk signals"
                title="Suspicion is a lead, never a verdict."
                sub="Signals aggregate into a score shown to operators — and nowhere else. No report is ever rejected, suppressed or delayed because of its risk score, its anonymity, missing OTP or missing GPS."
              />
              <div className="mt-6 flex flex-col gap-3 text-[13.5px] leading-relaxed text-slate-400">
                <p className="flex gap-2.5"><Scale className="mt-0.5 h-4 w-4 shrink-0 text-ease-sky" aria-hidden="true" />Emergency severity and fraud suspicion are stored and displayed separately, forever.</p>
                <p className="flex gap-2.5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />An anonymous report is treated exactly like a signed-in one — anonymity itself is never a signal.</p>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="rounded-2xl border border-ease-line bg-ease-panel p-6" data-testid="risk-signal-samples">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-500">Example signals · sample data</p>
                <div className="mt-4 flex flex-col gap-3">
                  {SIGNALS.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-ease-line bg-ease-card p-4">
                      <div>
                        <span className={`rounded border px-1.5 text-[10px] font-bold ${s.tone}`}>{s.kind}</span>
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-200">{s.text}</p>
                      </div>
                      <span className="font-data text-xs text-slate-500">+{s.weight}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11.5px] leading-relaxed text-slate-500">
                  Signals inform review. A high score queues the incident for a human look — it
                  never blocks dispatch or suppresses the report.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* auditability */}
      <section className="border-t border-ease-line bg-ease-panel py-20">
        <Container>
          <Reveal>
            <SectionHead
              dark
              eyebrow="Auditability"
              title="Every decision leaves a receipt."
              sub="Acknowledge, prioritise, assign, flag, review, resolve, reopen — each action writes actor, role, reason and before/after values to an append-only ledger."
            />
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10 overflow-hidden rounded-2xl border border-ease-line" data-testid="audit-sample-table">
              <div className="flex items-center justify-between border-b border-ease-line bg-ease-card px-4 py-2.5">
                <span className="text-xs text-slate-300">Audit ledger · extract (sample entries)</span>
                <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">Sample data</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-ease-line text-[10.5px] uppercase tracking-wider text-slate-500">
                      {["#", "Actor", "Action", "Target", "Reason", "Before → After"].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ease-line/60">
                    {AUDIT.map((row) => (
                      <tr key={row[0] as string} className="text-slate-300">
                        <td className="px-4 py-3 font-data text-slate-500">{row[0]}</td>
                        <td className="px-4 py-3">{row[1]}</td>
                        <td className="px-4 py-3 font-medium text-white">{row[2]}</td>
                        <td className="px-4 py-3 font-data">{row[3]}</td>
                        <td className="px-4 py-3 text-slate-400">{row[4]}</td>
                        <td className="px-4 py-3 font-data text-slate-400">{row[5]}{row[6] ? ` → ${row[6]}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 flex items-center gap-2 text-[12px] text-slate-500">
              <FileClock className="h-4 w-4" aria-hidden="true" />
              In the live app this ledger is served from the audit collection — filterable by actor, action and target.
            </p>
          </Reveal>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
