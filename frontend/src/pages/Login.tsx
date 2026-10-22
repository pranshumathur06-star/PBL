import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { PhoneCall, ArrowLeft, KeyRound, UserRound, Siren } from "lucide-react";
import SiteNav from "@/components/site/SiteNav";
import Reveal from "@/components/site/Reveal";
import { Container } from "@/components/site/ui";
import { apiPost, ApiError } from "@/lib/api";
import { beginSession, endSession } from "@/lib/session";
import type { SessionUser } from "@/types";

const DEMO_ACCOUNTS = [
  ["admin@ease.demo", "Admin"],
  ["dispatcher@ease.demo", "Dispatcher"],
  ["analyst@ease.demo", "Read-only analyst"],
];
const DEMO_PASSWORD = "EaseDemo112";

function errText(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && err.body !== null && "detail" in err.body) {
    return String((err.body as { detail: unknown }).detail);
  }
  if (err instanceof Error && err.message) return err.message;
  return "Could not reach the demo backend. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"citizen" | "staff">("citizen");
  const [mode, setMode] = useState<"in" | "reg" | "otp">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // citizen
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState("");
  // staff
  const [email, setEmail] = useState("");
  const [staffPw, setStaffPw] = useState("");
  const [bootstrapNeeded, setBootstrapNeeded] = useState(false);
  const [adminName, setAdminName] = useState("");

  const enter = (u: SessionUser) => {
    beginSession(); // wipes any cached state from a previous session on this browser
    toast(`Signed in as ${u.name}`);
    navigate(u.type === "staff" ? "/ops" : "/app");
  };

  const citizenSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone.trim())) return setError("Enter a valid 10-digit Indian mobile number.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      const u = await apiPost<SessionUser>("/auth/citizen/login", { ident: phone.trim(), password });
      enter(u);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const citizenOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!/^[6-9]\d{9}$/.test(phone.trim())) return setError("Enter a valid 10-digit Indian mobile number.");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return setError("Password needs at least 8 characters with a letter and a digit.");
    setBusy(true);
    try {
      const res = await apiPost<{ demo_code: string; note: string }>("/auth/citizen/otp", {
        name: name.trim(), phone: phone.trim(), password,
      });
      setDemoCode(res.demo_code);
      setMode("otp");
      toast.info("Demo verification code generated", { description: res.note });
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const citizenRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await apiPost<SessionUser>("/auth/citizen/register", {
        name: name.trim(), phone: phone.trim(), password, code: code.trim(),
      });
      enter(u);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const staffSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter your work email address.");
    if (!staffPw) return setError("Enter your password.");
    setBusy(true);
    try {
      const u = await apiPost<SessionUser>("/auth/staff/login", { ident: email.trim().toLowerCase(), password: staffPw });
      enter(u);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setBootstrapNeeded(true);
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const staffBootstrap = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (adminName.trim().length < 2) return setError("Enter the administrator's name.");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return setError("Password needs at least 8 characters with a letter and a digit.");
    if (password !== staffPw) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      const u = await apiPost<SessionUser>("/auth/staff/bootstrap", {
        name: adminName.trim(), email: email.trim().toLowerCase(), password,
      });
      enter(u);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const guest = () => {
    beginSession();
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-ease-navy">
      <SiteNav />
      <section className="relative overflow-hidden pt-36 pb-20 lg:pt-44">
        <div className="grid-bg anim-grid absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-24 left-1/2 h-80 w-96 -translate-x-1/2 rounded-full bg-ease-blue/20 blur-[110px]" aria-hidden="true" />
        <Container className="relative max-w-lg">
          <Reveal>
            <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the site
            </Link>
            <h1 className="mt-5 font-heading text-3xl font-extrabold text-white sm:text-4xl">Sign in to EASE</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Reporting never requires an account — guests can{" "}
              <button onClick={guest} data-testid="login-guest-button" className="font-semibold text-ease-sky underline underline-offset-2">
                report as a guest
              </button>{" "}
              straight away.
            </p>

            <div className="mt-8 rounded-2xl border border-ease-line bg-ease-panel p-6" data-testid="login-card">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-ease-card p-1" role="tablist" aria-label="Account type">
                {(["citizen", "staff"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => { setTab(t); setError(""); }}
                    data-testid={`login-tab-${t}`}
                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      tab === t ? "bg-ease-blue text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t === "citizen" ? "Citizen" : "Staff / Command Centre"}
                  </button>
                ))}
              </div>

              {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300" data-testid="login-error" role="alert">{error}</p>}

              {tab === "citizen" && mode === "in" && (
                <form onSubmit={citizenSignIn} className="mt-5 flex flex-col gap-4" data-testid="citizen-login-form">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Mobile number</span>
                    <input
                      value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" autoComplete="username"
                      placeholder="10-digit Indian mobile" data-testid="citizen-login-phone"
                      className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Password</span>
                    <input
                      value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
                      data-testid="citizen-login-password"
                      className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none"
                    />
                  </label>
                  <button type="submit" disabled={busy} data-testid="citizen-login-submit" className="rounded-xl bg-ease-blue py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60">
                    Sign in as citizen
                  </button>
                  <button type="button" onClick={() => { setMode("reg"); setError(""); }} className="text-[13px] text-slate-400 hover:text-slate-200">
                    New here? Create a citizen account
                  </button>
                </form>
              )}

              {tab === "citizen" && mode === "reg" && (
                <form onSubmit={citizenOtp} className="mt-5 flex flex-col gap-4" data-testid="citizen-register-form">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Full name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} data-testid="citizen-register-name" className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none" placeholder="Your name" />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Mobile number</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" data-testid="citizen-register-phone" className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none" placeholder="10-digit Indian mobile" />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Password</span>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" data-testid="citizen-register-password" className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none" />
                    <span className="mt-1 block text-[11.5px] text-slate-500">At least 8 characters with a letter and a digit.</span>
                  </label>
                  <button type="submit" disabled={busy} data-testid="citizen-register-submit" className="rounded-xl bg-ease-blue py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60">
                    Get verification code
                  </button>
                  <button type="button" onClick={() => { setMode("in"); setError(""); }} className="text-[13px] text-slate-400 hover:text-slate-200">
                    Already registered? Sign in
                  </button>
                </form>
              )}

              {tab === "citizen" && mode === "otp" && (
                <form onSubmit={citizenRegister} className="mt-5 flex flex-col gap-4" data-testid="citizen-otp-form">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-200" data-testid="citizen-otp-demo-note">
                    Demo only: no SMS is sent to +91 {phone}. Your verification code is{" "}
                    <strong className="font-data text-white">{demoCode}</strong>.
                  </div>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Enter the code</span>
                    <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={4} data-testid="citizen-otp-code" className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 font-data text-lg tracking-[0.4em] text-white focus:border-ease-sky focus:outline-none" />
                  </label>
                  <button type="submit" disabled={busy} data-testid="citizen-otp-submit" className="rounded-xl bg-ease-blue py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60">
                    Create account & continue
                  </button>
                </form>
              )}

              {tab === "staff" && (
                <form onSubmit={staffSignIn} className="mt-5 flex flex-col gap-4" data-testid="staff-login-form">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Work email</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" data-testid="staff-login-email" className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none" placeholder="name@ease.demo" />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-slate-200">Password</span>
                    <input value={staffPw} onChange={(e) => setStaffPw(e.target.value)} type="password" autoComplete="current-password" data-testid="staff-login-password" className="mt-1.5 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2.5 text-sm text-white focus:border-ease-sky focus:outline-none" />
                  </label>
                  <button type="submit" disabled={busy} data-testid="staff-login-submit" className="rounded-xl bg-ease-blue py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60">
                    Sign in to Command Centre
                  </button>
                  {bootstrapNeeded && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-amber-200" data-testid="staff-bootstrap-note">
                      No administrator exists yet. Set the name and password here and the first
                      staff account will be created with the Admin role.
                      <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Administrator name" data-testid="staff-bootstrap-name" className="mt-2 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2 text-sm text-white focus:border-ease-sky focus:outline-none" />
                      <input value={staffPw} onChange={(e) => setStaffPw(e.target.value)} type="password" placeholder="Admin password (8+ chars, letter + digit)" data-testid="staff-bootstrap-password" className="mt-2 w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2 text-sm text-white focus:border-ease-sky focus:outline-none" />
                      <button type="submit" onClick={staffBootstrap} data-testid="staff-bootstrap-submit" className="mt-2 w-full rounded-lg bg-ease-amber py-2 text-[13px] font-bold text-white transition hover:opacity-90">
                        Create first admin account
                      </button>
                    </div>
                  )}
                  <div className="rounded-lg border border-ease-line bg-ease-card p-3.5" data-testid="demo-accounts-box">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Demo accounts
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {DEMO_ACCOUNTS.map(([em, role]) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => { setTab("staff"); setEmail(em); setStaffPw(DEMO_PASSWORD); setError(""); }}
                          data-testid={`demo-account-${em.split("@")[0]}`}
                          className="flex items-center justify-between rounded-lg border border-ease-line2 px-3 py-2 text-left text-[12.5px] text-slate-300 transition hover:border-ease-sky hover:text-white"
                        >
                          <span className="font-data">{em}</span>
                          <span className="text-[11px] text-slate-500">{role}</span>
                        </button>
                      ))}
                      <p className="mt-1 text-[11px] text-slate-500">Password for all three: <span className="font-data text-slate-300">EaseDemo112</span></p>
                    </div>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 text-[12.5px] leading-relaxed text-slate-500">
              <p className="flex gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Citizen accounts save your report history — they are never required to report.</p>
              <p className="flex gap-2"><PhoneCall className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />In a real emergency, call <strong className="text-slate-300">112</strong>. EASE is a demonstration and cannot dispatch help.</p>
              <p className="flex gap-2"><Siren className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Staff roles (Dispatcher / Supervisor / Admin / Analyst) are enforced server-side on every action.</p>
            </div>
          </Reveal>
        </Container>
      </section>
    </div>
  );
}
