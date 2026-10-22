import { useState, type FormEvent } from "react";
import { CheckCircle2, Send, ShieldAlert } from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import Reveal from "@/components/site/Reveal";
import { Container, SectionHead } from "@/components/site/ui";
import { apiPost, ApiError } from "@/lib/api";

type Status = "idle" | "sending" | "done" | "error";

export default function Contact() {
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState({ name: "", email: "", org: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const er: Record<string, string> = {};
    if (form.name.trim().length < 2) er.name = "Enter your name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) er.email = "Enter a valid email address.";
    if (form.message.trim().length < 10) er.message = "Tell us a little more (at least 10 characters).";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    try {
      const res = await apiPost<{ ok: boolean; note: string }>("/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        org: form.org.trim() || null,
        message: form.message.trim(),
      });
      setFeedback(res.note);
      setStatus("done");
      setForm({ name: "", email: "", org: "", message: "" });
    } catch (err) {
      const msg = err instanceof ApiError && err.body && typeof err.body === "object" && err.body !== null && "detail" in err.body
        ? String((err.body as { detail: unknown }).detail)
        : "Could not reach the demo backend. Please try again in a moment.";
      setFeedback(msg);
      setStatus("error");
    }
  };

  return (
    <div className="bg-[#F8FAFC]">
      <SiteNav />

      <section className="relative overflow-hidden bg-ease-navy pt-36 pb-20 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 right-[10%] h-80 w-80 rounded-full bg-ease-blue/20 blur-[110px]" aria-hidden="true" />
        <Container className="relative">
          <SectionHead
            dark
            eyebrow="Contact & project overview"
            title="A student-built demonstration, described honestly."
            sub="EASE — Emergency Assistance & Smart Escalation — is a B.Tech project exploring how citizen reporting, Dijkstra routing, human-led dispatch and auditability can come together in one public-safety platform."
          />
        </Container>
      </section>

      <section className="py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <Reveal>
                <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                  <h3 className="font-heading text-base font-bold text-slate-900">What this project is</h3>
                  <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-slate-600">
                    <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />A working end-to-end demo: citizen reporting → command-centre triage → eligible assignment → audit.</li>
                    <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />A real full-stack build: FastAPI + MongoDB behind a React front end.</li>
                    <li className="flex gap-2.5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />A case for honest interface design: simulation labelled, estimates marked, 112 always visible.</li>
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={120}>
                <div className="mt-5 rounded-2xl border border-red-200 bg-[#FFF5F5] p-6 text-sm leading-relaxed text-slate-700">
                  <p className="flex gap-2 font-semibold text-slate-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ease-red" aria-hidden="true" />What this is not</p>
                  <p className="mt-2">
                    EASE has no company address, official contact number, institutional
                    affiliation or partnership — and none are invented here. It is not connected
                    to any emergency service. In a real emergency in India, call{" "}
                    <a href="tel:112" className="font-bold text-ease-red underline">112</a>.
                  </p>
                </div>
              </Reveal>
            </div>

            <Reveal delay={100}>
              <form onSubmit={submit} noValidate className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm" data-testid="contact-form">
                <h3 className="font-heading text-lg font-bold text-slate-900">Request a walkthrough</h3>
                <p className="mt-1.5 text-[13px] text-slate-500">
                  Want a guided demo for a class, a review panel or a potential collaborator?
                  Leave a note — it is stored in the project's demonstration database.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-700">Name</span>
                    <input
                      value={form.name} onChange={set("name")} data-testid="contact-name-input"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-ease-blue focus:outline-none"
                      placeholder="Your name"
                    />
                    {errors.name && <span className="mt-1 block text-xs text-ease-red">{errors.name}</span>}
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-700">Email</span>
                    <input
                      value={form.email} onChange={set("email")} type="email" data-testid="contact-email-input"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-ease-blue focus:outline-none"
                      placeholder="you@example.com"
                    />
                    {errors.email && <span className="mt-1 block text-xs text-ease-red">{errors.email}</span>}
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="text-[13px] font-semibold text-slate-700">Organisation <span className="font-normal text-slate-400">(optional)</span></span>
                  <input
                    value={form.org} onChange={set("org")} data-testid="contact-org-input"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-ease-blue focus:outline-none"
                    placeholder="College, team or company"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-[13px] font-semibold text-slate-700">Message</span>
                  <textarea
                    value={form.message} onChange={set("message")} rows={5} data-testid="contact-message-input"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-ease-blue focus:outline-none"
                    placeholder="What would you like to see?"
                  />
                  {errors.message && <span className="mt-1 block text-xs text-ease-red">{errors.message}</span>}
                </label>

                <button
                  type="submit" disabled={status === "sending"} data-testid="contact-submit-button"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ease-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {status === "sending" ? "Sending…" : "Send request"}
                </button>

                {status === "done" && (
                  <p className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800" data-testid="contact-success-note">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{feedback}
                  </p>
                )}
                {status === "error" && (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" data-testid="contact-error-note">{feedback}</p>
                )}
                <p className="mt-4 text-[11.5px] leading-relaxed text-slate-400">
                  Honest by design: this form does not send email. Submissions are recorded in
                  the demo database and shown to nobody but the project team.
                </p>
              </form>
            </Reveal>
          </div>
        </Container>
      </section>

      <SiteFooter />
    </div>
  );
}
