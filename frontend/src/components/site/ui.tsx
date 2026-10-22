import type { ReactNode } from "react";

// Shared marketing-page primitives — small, composable, dark/light aware.

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function SectionHead({
  eyebrow, title, sub, dark = false, center = false,
}: {
  eyebrow: string; title: ReactNode; sub?: string; dark?: boolean; center?: boolean;
}) {
  return (
    <div className={`max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <p className={`font-data text-[11px] font-bold uppercase tracking-[0.22em] ${dark ? "text-ease-sky" : "text-ease-blue"}`}>
        {eyebrow}
      </p>
      <h2 className={`mt-3 font-heading text-3xl font-extrabold leading-[1.12] sm:text-4xl ${dark ? "text-white" : "text-slate-900"}`}>
        {title}
      </h2>
      {sub && <p className={`mt-4 text-base leading-relaxed ${dark ? "text-slate-400" : "text-slate-600"}`}>{sub}</p>}
    </div>
  );
}

export function Tag({ children, tone = "sky" }: { children: ReactNode; tone?: "sky" | "green" | "amber" | "red" | "slate" }) {
  const tones: Record<string, string> = {
    sky: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    slate: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  };
  const light: Record<string, string> = {
    sky: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone === "slate" || true ? "" : ""} ${tones[tone] ?? tones.sky}`} data-tone-dark={tones[tone]} data-tone-light={light[tone]}>
      {children}
    </span>
  );
}

export function DemoLabel({ children = "Sample data · simulated demonstration" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" />
      </svg>
      {children}
    </span>
  );
}
