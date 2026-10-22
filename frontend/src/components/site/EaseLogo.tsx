export default function EaseLogo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-ease-red shadow-[0_0_18px_rgba(225,29,72,0.45)]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ease-sky anim-blink" aria-hidden="true" />
      </span>
      {!compact && (
        <span className={`font-heading text-lg font-extrabold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
          EASE
          <span className={`ml-1.5 hidden align-middle text-[10px] font-semibold uppercase tracking-[0.18em] 2xl:inline ${dark ? "text-slate-400" : "text-slate-500"}`}>
            Emergency Assistance &amp; Smart Escalation
          </span>
        </span>
      )}
    </span>
  );
}
