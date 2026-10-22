import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, PhoneCall, X, ArrowUpRight, ShieldCheck } from "lucide-react";
import EaseLogo from "./EaseLogo";
import { useSession } from "@/hooks/useSession";
import { apiPost } from "@/lib/api";
import { beginSession, endSession } from "@/lib/session";
import { toast } from "sonner";

const LINKS = [
  { to: "/platform", label: "Platform" },
  { to: "/citizen", label: "Citizen App" },
  { to: "/command-centre", label: "Command Centre" },
  { to: "/intelligence", label: "Intelligence" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/trust", label: "Trust" },
];

// Marketing chrome: 112 SOS strip + glass navigation + mobile sheet. Used on every public page.
export default function SiteNav() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const signOut = async () => {
    await endSession("/");
    toast("Signed out");
  };

  const signIn = async () => {
    // Visitor convenience: entering the citizen app as guest needs no account at all.
    beginSession();
    navigate("/app");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      {/* 112 fallback — always first, never hidden behind a menu */}
      <div className="bg-[#450A0A] text-[#FEE2E2]">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-[12.5px] sm:justify-between">
          <p className="flex items-center gap-2">
            <PhoneCall className="h-3.5 w-3.5 text-red-300" aria-hidden="true" />
            <span>
              In immediate danger? Call <a href="tel:112" data-testid="nav-112-link" className="font-bold text-white underline decoration-red-400 underline-offset-2">112</a> now. EASE never replaces the 112 emergency line.
            </span>
          </p>
          <span className="hidden items-center gap-1.5 text-[11.5px] text-red-200/80 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Demonstration project — no live emergency services
          </span>
        </div>
      </div>

      <div className="glass border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" data-testid="nav-brand" aria-label="EASE home">
            <EaseLogo dark />
          </Link>

          <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    isActive ? "text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <span className="flex-1" />

          <div className="hidden items-center gap-2.5 lg:flex">
            {user ? (
              <>
                <span className="rounded-full border border-ease-line2 bg-ease-card px-3 py-1.5 text-xs text-slate-300" data-testid="nav-user-badge">
                  {user.name} · {user.role}
                </span>
                {user.type === "staff" ? (
                  <Link to="/ops" className="rounded-lg bg-ease-blue px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1D4ED8]">
                    Open Command Centre
                  </Link>
                ) : (
                  <Link to="/app" className="rounded-lg bg-ease-blue px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1D4ED8]">
                    Open Citizen App
                  </Link>
                )}
                <button onClick={signOut} data-testid="nav-signout-button" className="rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition hover:text-white">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button onClick={signIn} data-testid="nav-report-button" className="whitespace-nowrap rounded-lg bg-ease-red px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_0_20px_rgba(225,29,72,0.35)] transition hover:bg-[#BE123C]">
                  Report an emergency
                </button>
                <Link to="/login" data-testid="nav-signin-link" className="whitespace-nowrap rounded-lg border border-ease-line2 px-3.5 py-2 text-[13px] font-medium text-slate-200 transition hover:border-ease-sky hover:text-white">
                  Sign in
                </Link>
              </>
            )}
          </div>

          <button
            className="grid h-10 w-10 place-items-center rounded-lg border border-ease-line2 text-slate-200 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            data-testid="nav-mobile-toggle"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* mobile panel */}
        <div
          className={`overflow-hidden border-t border-ease-line/60 transition-[max-height,opacity] duration-300 lg:hidden ${open ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"}`}
        >
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4" aria-label="Mobile">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-white/10 text-white" : "text-slate-300"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-ease-line/60 pt-4">
              {user ? (
                <>
                  <Link to={user.type === "staff" ? "/ops" : "/app"} onClick={() => setOpen(false)} className="rounded-lg bg-ease-blue px-3.5 py-2.5 text-center text-sm font-semibold text-white">
                    Open {user.type === "staff" ? "Command Centre" : "Citizen App"}
                  </Link>
                  <button onClick={signOut} className="rounded-lg border border-ease-line2 px-3.5 py-2.5 text-sm text-slate-200">Sign out</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setOpen(false); signIn(); }} data-testid="nav-mobile-report-button" className="rounded-lg bg-ease-red px-3.5 py-2.5 text-sm font-semibold text-white">
                    Report an emergency
                  </button>
                  <Link to="/login" onClick={() => setOpen(false)} className="rounded-lg border border-ease-line2 px-3.5 py-2.5 text-center text-sm text-slate-200">
                    Sign in <ArrowUpRight className="inline h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
