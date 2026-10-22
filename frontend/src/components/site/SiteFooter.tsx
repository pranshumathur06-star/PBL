import { Link } from "react-router-dom";
import { PhoneCall } from "lucide-react";
import EaseLogo from "./EaseLogo";

const COLS = [
  {
    h: "Platform",
    links: [
      ["Platform overview", "/platform"],
      ["Routing & risk review", "/intelligence"],
      ["How EASE works", "/how-it-works"],
      ["Trust & transparency", "/trust"],
    ],
  },
  {
    h: "Products",
    links: [
      ["Citizen App", "/citizen"],
      ["Command Centre", "/command-centre"],
      ["Open Citizen App", "/app"],
      ["Open Command Centre", "/ops"],
    ],
  },
  {
    h: "Project",
    links: [
      ["Sign in", "/login"],
      ["Contact & demo", "/contact"],
      ["About this demonstration", "/trust"],
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="bg-ease-navy text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <EaseLogo dark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              EASE connects emergency reports, location intelligence and human-led response
              coordination in one unified platform — built as a demonstration of what a
              modern public-safety stack can feel like.
            </p>
            <a href="tel:112" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-red-900 bg-[#450A0A] px-3.5 py-2 text-sm font-semibold text-red-100 transition hover:border-red-500">
              <PhoneCall className="h-4 w-4" aria-hidden="true" /> Emergency: 112 (India)
            </a>
          </div>
          {COLS.map((c) => (
            <div key={c.h}>
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">{c.h}</h4>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {c.links.map(([label, to]) => (
                  <li key={label + to}>
                    <Link to={to} className="transition-colors hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-ease-line/70 pt-6 text-xs leading-relaxed sm:flex-row sm:items-start sm:justify-between">
          <p>
            EASE is a student-built demonstration platform. It is not connected to any
            emergency service, and reports are handled by a demo command centre only.
            Map visuals are original illustrations using sample data — not real operational maps.
          </p>
          <p className="shrink-0 sm:text-right">
            No invented statistics. Simulated activity is always labelled.
          </p>
        </div>
      </div>
    </footer>
  );
}
