import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ListFilter, Truck, FileClock, BarChart3, Users, LogOut, Search, Siren, CheckCircle2, Flag,
  ShieldAlert, RotateCcw, MessageSquare, StickyNote, ArrowLeft, Lock, PhoneCall, BellRing, Volume2, VolumeX, X,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { endSession } from "@/lib/session";
import DijkstraMap from "@/components/viz/DijkstraMap";
import { useCriticalAlerts } from "@/hooks/useCriticalAlerts";
import type { Analytics, AuditEntry, QueueResponse, Report, Unit, UserAdminView } from "@/types";
import { CATEGORY_LABELS, SEVERITIES } from "@/types";

// Permission table mirrored from backend/lib/security.py — used ONLY to hide controls.
// The backend enforces every one of these on each request.
const ALL = ["ack", "review_st", "prio", "note", "assign", "link", "resolve", "unit", "rview", "rview2", "reopen", "flag", "users", "settings"];
const PERM: Record<string, string[]> = {
  Dispatcher: ["ack", "review_st", "prio", "note", "assign", "link", "resolve", "unit", "rview", "flag"],
  Supervisor: [...ALL.slice(0, 12), "reopen"],
  Admin: ALL,
  "Read-only analyst": [],
};
const NEXT: Record<string, string[]> = {
  Reported: ["Acknowledged", "Under review"], Acknowledged: ["Under review"], "Under review": ["Acknowledged"],
  Assigned: ["En route", "On scene"], "En route": ["On scene"],
};
const SVC: Record<string, string> = { medical: "ambulance", accident: "ambulance", fire: "fire", flood: "fire", theft: "police", violence: "police", ev: "mech" };
const SEV_TONE: Record<string, string> = {
  Critical: "border-red-500/40 bg-red-500/15 text-red-300", High: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  Medium: "border-sky-500/40 bg-sky-500/15 text-sky-300", Low: "border-slate-500/40 bg-slate-500/15 text-slate-300",
};
const UNIT_TONE: Record<string, string> = {
  Available: "text-emerald-300", Assigned: "text-sky-300", "En route": "text-amber-300", "On scene": "text-amber-300",
  "Temporarily unavailable": "text-slate-400", "Offline / location stale": "text-red-300",
};

function errText(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && err.body !== null && "detail" in err.body) {
    const d = (err.body as { detail: unknown }).detail;
    return typeof d === "string" ? d : "Request rejected.";
  }
  return "Could not reach the demo backend.";
}
const mins = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Tab = "queue" | "units" | "audit" | "analytics" | "users";

export default function CommandCentreOps() {
  const { user, isLoading } = useSession();
  if (isLoading) return <div className="grid min-h-screen place-items-center bg-ease-navy text-sm text-slate-400">Loading Command Centre…</div>;
  if (!user || user.type !== "staff") return <Gate />;
  return <Console role={user.role} name={user.name} />;
}

function Gate() {
  return (
    <div className="grid min-h-screen place-items-center bg-ease-navy px-4">
      <div className="grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-ease-line bg-ease-panel p-8 text-center" data-testid="ops-gate">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-ease-blue/15 text-ease-sky"><Lock className="h-5 w-5" aria-hidden="true" /></span>
        <h1 className="mt-4 font-heading text-xl font-extrabold text-white">Staff sign-in required</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">The Command Centre is for operations staff. Demo dispatcher, admin and analyst accounts are listed on the sign-in page.</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link to="/login" data-testid="ops-gate-signin" className="rounded-xl bg-ease-blue py-3 text-sm font-bold text-white transition hover:bg-[#1D4ED8]">Go to staff sign-in</Link>
          <Link to="/command-centre" className="rounded-xl border border-ease-line2 py-3 text-sm text-slate-300 transition hover:border-ease-sky">Learn about the Command Centre</Link>
        </div>
      </div>
    </div>
  );
}

function Console({ role, name }: { role: string; name: string }) {
  const can = (p: string) => (PERM[role] ?? []).includes(p);
  const [tab, setTab] = useState<Tab>("queue");
  const [sel, setSel] = useState<string | null>(null);
  const { alerts, dismiss, sound, setSound } = useCriticalAlerts();
  const openAlert = (code: string) => { setTab("queue"); setSel(code); dismiss(code); };
  const tabs: [Tab, string, typeof ListFilter][] = [
    ["queue", "Incident queue", ListFilter], ["units", "Response units", Truck], ["audit", "Audit log", FileClock],
    ["analytics", "Analytics", BarChart3], ...(can("users") ? [["users", "Users & roles", Users] as [Tab, string, typeof ListFilter]] : []),
  ];

  return (
    <div className="min-h-screen bg-ease-navy text-slate-100">
      <header className="sticky top-0 z-30 border-b border-ease-line bg-ease-panel/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-1.5 text-[13px] text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Site</Link>
          <span className="flex items-center gap-2 font-heading text-sm font-bold"><span className="grid h-6 w-6 place-items-center rounded-md bg-ease-red"><Siren className="h-3.5 w-3.5" aria-hidden="true" /></span>EASE Command Centre</span>
          <span className="hidden rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 md:inline">Demo · sample data · no real dispatch</span>
          <span className="flex-1" />
          <a href="tel:112" className="hidden items-center gap-1 text-[12px] text-red-300 sm:flex"><PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />112</a>
          <button onClick={() => setSound(!sound)} aria-pressed={sound} data-testid="ops-sound-toggle" title={sound ? "Alert chime on" : "Alert chime off"}
            className="flex items-center gap-1.5 rounded-lg border border-ease-line2 px-2.5 py-1 text-[12px] text-slate-300 transition hover:border-ease-sky">
            {sound ? <Volume2 className="h-4 w-4 text-ease-sky" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}{sound ? "Chime on" : "Chime off"}
          </button>
          <span className="rounded-full border border-ease-line2 bg-ease-card px-3 py-1 text-xs text-slate-300" data-testid="ops-user-badge">{name} · {role}</span>
          <button onClick={() => endSession("/login")} data-testid="ops-signout" className="flex items-center gap-1.5 text-[13px] text-slate-400 transition hover:text-white"><LogOut className="h-4 w-4" aria-hidden="true" />Sign out</button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Command Centre sections">
          {tabs.map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined} data-testid={`ops-tab-${t}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === t ? "bg-ease-blue text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />{label}
            </button>
          ))}
        </nav>
      </header>
      {role === "Read-only analyst" && (
        <div className="border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-[12.5px] text-sky-200" data-testid="ops-readonly-banner">Read-only role: you can see everything, change nothing. The server rejects any write from this account.</div>
      )}
      {alerts.length > 0 && (
        <div className="sticky top-[104px] z-20 flex flex-col gap-2 px-4 pt-3" role="alert" aria-live="assertive" data-testid="ops-critical-alerts">
          {alerts.map((r) => (
            <div key={r.code} className="flex items-center gap-3 rounded-xl border border-red-500/50 bg-[#3B0A12]/95 px-4 py-3 shadow-[0_12px_40px_rgba(225,29,72,0.35)] backdrop-blur" data-testid={`ops-alert-${r.code}`}>
              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ease-red">
                <BellRing className="h-4.5 w-4.5 text-white" aria-hidden="true" />
                <span className="absolute inset-0 rounded-lg border-2 border-red-400 anim-ping" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold uppercase tracking-wider text-red-300">New Critical report · {r.label} · <span className="font-data">{r.code}</span></p>
                <p className="truncate text-[13.5px] text-red-50">{r.text}</p>
                <p className="text-[11px] text-red-200/70">{r.loc.address || "Location not shared"}</p>
              </div>
              <button onClick={() => openAlert(r.code)} data-testid={`ops-alert-open-${r.code}`} className="shrink-0 rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-bold text-ease-red transition hover:bg-red-50">Review now</button>
              <button onClick={() => dismiss(r.code)} aria-label={`Dismiss alert for ${r.code}`} data-testid={`ops-alert-dismiss-${r.code}`} className="shrink-0 rounded-lg p-1.5 text-red-200 transition hover:bg-white/10"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      )}
      <main className="p-4">
        {tab === "queue" && <QueueTab can={can} sel={sel} setSel={setSel} />}
        {tab === "units" && <UnitsTab can={can} />}
        {tab === "audit" && <AuditTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "users" && can("users") && <UsersTab />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ queue + detail
function QueueTab({ can, sel, setSel }: { can: (p: string) => boolean; sel: string | null; setSel: (c: string | null) => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (severity) params.set("severity", severity);
  if (category) params.set("category", category);
  if (q.trim()) params.set("q", q.trim());
  const queue = useQuery({
    queryKey: ["ops-queue", params.toString()],
    queryFn: () => apiGet<QueueResponse>(`/ops/queue?${params.toString()}`),
    refetchInterval: 8000,
  });
  const units = useQuery({ queryKey: ["ops-units"], queryFn: () => apiGet<Unit[]>("/ops/units"), refetchInterval: 10000 });

  const items = useMemo(() => {
    const all = queue.data?.items ?? [];
    return activeOnly && !status ? all.filter((r) => !["Resolved", "Closed", "Cancelled"].includes(r.status)) : all;
  }, [queue.data, activeOnly, status]);
  const selected = items.find((r) => r.code === sel) ?? (queue.data?.items ?? []).find((r) => r.code === sel) ?? null;

  const refresh = (code?: string) => {
    qc.invalidateQueries({ queryKey: ["ops-queue"] });
    qc.invalidateQueries({ queryKey: ["ops-units"] });
    qc.invalidateQueries({ queryKey: ["ops-audit"] });
    qc.invalidateQueries({ queryKey: ["ops-analytics"] });
    if (code) qc.invalidateQueries({ queryKey: ["report", code] });
  };

  const selectCls = "rounded-lg border border-ease-line2 bg-ease-card px-2.5 py-1.5 text-[12.5px] text-slate-200 focus:border-ease-sky focus:outline-none";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(380px,0.9fr)_1.1fr]">
      <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-ease-line bg-ease-panel" data-testid="ops-queue">
        <div className="flex flex-wrap items-center gap-2 border-b border-ease-line p-3">
          <label className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, text, address" data-testid="ops-queue-search"
              className="w-full rounded-lg border border-ease-line2 bg-ease-card py-1.5 pl-8 pr-3 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
          </label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity" data-testid="ops-filter-severity" className={selectCls}>
            <option value="">All severities</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" data-testid="ops-filter-category" className={selectCls}>
            <option value="">All categories</option>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" data-testid="ops-filter-status" className={selectCls}>
            <option value="">Any status</option>{["Reported", "Acknowledged", "Under review", "Assigned", "En route", "On scene", "Resolved", "Closed", "Cancelled"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} data-testid="ops-filter-active" className="accent-ease-sky" />Active only
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {queue.isLoading && <div className="flex flex-col gap-2 p-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-ease-card" />)}</div>}
          {queue.isError && <p className="p-6 text-center text-sm text-red-300">Queue unavailable — {errText(queue.error)}</p>}
          {!queue.isLoading && items.length === 0 && !queue.isError && <p className="p-8 text-center text-sm text-slate-500" data-testid="ops-queue-empty">No incidents match these filters.</p>}
          {items.map((r) => (
            <button key={r.id} onClick={() => setSel(r.code)} aria-pressed={sel === r.code} data-testid={`ops-queue-row-${r.code}`}
              className={`flex w-full items-start gap-3 border-b border-l-2 border-b-ease-line/60 px-3.5 py-3 text-left transition-colors ${sel === r.code ? "border-l-ease-sky bg-ease-card" : "border-l-transparent hover:bg-white/[0.03]"}`}>
              <span className={`mt-0.5 rounded border px-1.5 text-[10px] font-bold ${SEV_TONE[r.severity]}`}>{r.severity}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-data">{r.code}</span>·<span>{r.label}</span>·<span>{mins(r.created_at)} min</span>
                  {r.sample && <span className="text-amber-400/80">sample</span>}
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-slate-200">{r.text}</span>
                <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px]">
                  <span className="text-slate-400">{r.status}</span>
                  {r.unit && <span className="text-sky-300">· {r.unit}</span>}
                  {r.risk.level !== "low" && <span className="text-amber-300">· risk {r.risk.level}</span>}
                  {r.flag && <span className="text-red-300">· flagged</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-ease-line px-3.5 py-2 text-[11px] text-slate-500">{items.length} shown · auto-refresh 8 s · sorted by severity, then time</div>
      </section>

      {selected ? (
        <Detail key={selected.code} r={selected} units={units.data ?? []} can={can} onChange={() => refresh(selected.code)} />
      ) : (
        <section className="grid min-h-[50vh] place-items-center rounded-2xl border border-dashed border-ease-line bg-ease-panel/50 p-8 text-center" data-testid="ops-detail-empty">
          <div>
            <ListFilter className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
            <p className="mt-3 text-sm text-slate-400">Select an incident to review, route and assign.</p>
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({ r, units, can, onChange }: { r: Report; units: Unit[]; can: (p: string) => boolean; onChange: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState<string>("");
  const [linkCode, setLinkCode] = useState("");
  const need = SVC[r.category];
  const eligible = units.filter((u) => u.active && (!need || u.svc === need));
  const unitForMap = units.find((u) => u.id === (pick || r.unit)) ?? eligible.find((u) => u.stat === "Available");
  const active = !["Resolved", "Closed", "Cancelled"].includes(r.status);

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) => apiPost<Report>(`/ops/incident/${r.code}/${path}`, body ?? {}),
    onSuccess: (_d, v) => { toast.success(`${r.code}: ${v.path} recorded`, { description: "Written to the audit log." }); setReason(""); onChange(); },
    onError: (e) => toast.error(errText(e)),
  });
  const run = (path: string, body?: unknown) => act.mutate({ path, body });
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition disabled:opacity-50";

  return (
    <section className="flex flex-col gap-4" data-testid="ops-detail">
      <div className="rounded-2xl border border-ease-line bg-ease-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${SEV_TONE[r.severity]}`} data-testid="ops-detail-severity">{r.severity}</span>
          <span className="rounded border border-ease-line2 bg-ease-card px-2 py-0.5 text-[11px] text-slate-300">{r.label}</span>
          <span className="rounded border border-ease-line2 bg-ease-card px-2 py-0.5 text-[11px] text-white" data-testid="ops-detail-status">{r.status}</span>
          {r.unit && <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300" data-testid="ops-detail-unit">{r.unit}{r.route_km != null && ` · ${r.route_km.toFixed(1)} km`}</span>}
          {r.sample && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">Sample record</span>}
          <span className="ml-auto font-data text-[12px] text-slate-500" data-testid="ops-detail-code">{r.code}</span>
        </div>
        <p className="mt-3 text-[14.5px] leading-relaxed text-slate-100">{r.text}</p>
        <div className="mt-3 grid gap-2 text-[12px] text-slate-400 sm:grid-cols-2">
          <p>Location: <span className="text-slate-200">{r.loc.address || (r.loc.lat != null ? `${r.loc.lat.toFixed(4)}, ${r.loc.lng?.toFixed(4)} (±${Math.round(r.loc.accuracy_m ?? 0)} m)` : "Not shared")}</span></p>
          <p>Reporter: <span className="text-slate-200">{r.reporter_name || (r.acct === "guest" ? "Guest" : "Citizen")}{r.phone ? ` · ${r.phone}` : ""}</span></p>
          {r.details.landmark && <p>Landmark: <span className="text-slate-200">{r.details.landmark}</span></p>}
          {r.details.injuries && <p>Injuries: <span className="text-slate-200">{r.details.injuries}</span></p>}
          {r.details.immediate_danger && <p className="text-red-300">Reporter says immediate danger persists</p>}
          <p>Received: <span className="text-slate-200">{ist(r.created_at)} IST</span></p>
        </div>

        {/* risk — kept visibly separate from severity */}
        {r.risk.signals.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5" data-testid="ops-detail-risk">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-300"><ShieldAlert className="h-4 w-4" aria-hidden="true" />Risk signals · score {r.risk.score} · {r.risk.level}{r.needs_review && " · needs review"}</p>
            <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-amber-100/90">{r.risk.signals.map((s, i) => <li key={i}>[{s.kind}] {s.text}</li>)}</ul>
            <p className="mt-2 text-[11px] text-amber-200/70">Signals inform review only. They never change severity, block dispatch or prove fraud.</p>
            {can("rview") && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button onClick={() => run("review", { decision: "cleared" })} data-testid="ops-review-clear" className={`${btn} border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}>Clear — genuine</button>
                <button onClick={() => run("review", { decision: "needs-review" })} data-testid="ops-review-needs" className={`${btn} border border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}>Needs further review</button>
                {can("rview2") && <button onClick={() => run("review", { decision: "escalated" })} data-testid="ops-review-escalate" className={`${btn} border border-red-500/40 text-red-300 hover:bg-red-500/10`}>Escalate to supervisor</button>}
              </div>
            )}
          </div>
        )}

        {/* actions */}
        <div className="mt-4 border-t border-ease-line pt-4">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (recorded in the audit log)" data-testid="ops-action-reason"
            className="w-full rounded-lg border border-ease-line2 bg-ease-card px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
          <div className="mt-3 flex flex-wrap gap-2">
            {can("ack") && r.status === "Reported" && <button onClick={() => run("ack", { reason: reason || null })} disabled={act.isPending} data-testid="ops-ack-button" className={`${btn} bg-ease-blue text-white hover:bg-[#1D4ED8]`}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Acknowledge</button>}
            {can("review_st") && (NEXT[r.status] ?? []).filter((s) => !(s === "Acknowledged" && r.status === "Reported")).map((s) => (
              <button key={s} onClick={() => run("status", { status: s, reason: reason || null })} disabled={act.isPending} data-testid={`ops-status-${s.toLowerCase().replace(/\s+/g, "-")}`} className={`${btn} border border-ease-line2 text-slate-200 hover:border-ease-sky`}>→ {s}</button>
            ))}
            {can("prio") && active && (
              <select value="" onChange={(e) => e.target.value && run("priority", { severity: e.target.value, reason: reason || null })} aria-label="Change priority" data-testid="ops-priority-select"
                className="rounded-lg border border-ease-line2 bg-ease-card px-2.5 py-2 text-[12.5px] text-slate-200 focus:outline-none">
                <option value="">Change priority…</option>{SEVERITIES.filter((s) => s !== r.severity).map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
            {can("resolve") && active && <button onClick={() => run("resolve", { reason: reason || null })} disabled={act.isPending} data-testid="ops-resolve-button" className={`${btn} border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}>Resolve</button>}
            {can("resolve") && r.status === "Resolved" && <button onClick={() => run("close", { reason: reason || null })} disabled={act.isPending} data-testid="ops-close-button" className={`${btn} border border-ease-line2 text-slate-300 hover:border-ease-sky`}>Close</button>}
            {can("reopen") && ["Resolved", "Closed"].includes(r.status) && <button onClick={() => run("reopen", { reason: reason || null })} data-testid="ops-reopen-button" className={`${btn} border border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}><RotateCcw className="h-4 w-4" aria-hidden="true" />Reopen</button>}
            {can("flag") && <button onClick={() => run("flag", { flag: !r.flag, reason: reason || null })} data-testid="ops-flag-button" className={`${btn} border border-ease-line2 text-slate-300 hover:border-red-400`}><Flag className="h-4 w-4" aria-hidden="true" />{r.flag ? "Remove flag" : "Flag"}</button>}
          </div>
          {!can("ack") && <p className="mt-2 text-[12px] text-slate-500" data-testid="ops-no-actions">Your role has no write permissions on incidents.</p>}
        </div>
      </div>

      {/* assignment + route */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-ease-line bg-ease-panel p-4" data-testid="ops-assign-panel">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Eligible units{need ? ` · ${need}` : " · any service"}</h3>
          <div className="mt-3 flex flex-col gap-1.5">
            {eligible.length === 0 && <p className="text-[12.5px] text-slate-500">No active units of the required service type. Mechanic-type incidents have no units in the sample fleet.</p>}
            {eligible.map((u) => (
              <label key={u.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${pick === u.id ? "border-ease-sky bg-ease-card" : "border-ease-line hover:border-ease-line2"}`}>
                <input type="radio" name={`unit-${r.code}`} checked={pick === u.id} onChange={() => setPick(u.id)} className="accent-ease-sky" data-testid={`ops-unit-option-${u.id}`} />
                <span className="flex-1"><span className="font-data text-[13px] text-white">{u.id}</span><span className="block text-[11px] text-slate-500">{u.facility} · {u.tags}</span></span>
                <span className={`text-[11px] font-semibold ${UNIT_TONE[u.stat] ?? "text-slate-400"}`}>{u.stat}</span>
              </label>
            ))}
          </div>
          {can("assign") && active && (
            <button onClick={() => pick && run("assign", { unit_id: pick, reason: reason || null })} disabled={!pick || act.isPending} data-testid="ops-assign-button"
              className={`${btn} mt-3 w-full justify-center bg-ease-red text-white hover:bg-[#BE123C]`}>
              <Siren className="h-4 w-4" aria-hidden="true" />{r.unit ? "Reassign" : "Assign"} {pick || "unit"}
            </button>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Assignment records the computed shortest path. Unit movement is not tracked — status is set by operators.</p>
        </div>
        <div>
          {unitForMap ? (
            <DijkstraMap explore={false} fixed={{ from: unitForMap.node, to: r.node }} compact />
          ) : (
            <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-ease-line bg-ease-panel p-6 text-center text-[12.5px] text-slate-500">Pick a unit to preview its shortest path to the incident.</div>
          )}
        </div>
      </div>

      {/* timeline, notes, replies */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-ease-line bg-ease-panel p-4" data-testid="ops-timeline">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Incident timeline</h3>
          <ol className="mt-3 flex flex-col gap-2.5">
            {[...r.hist].reverse().map((h, i) => (
              <li key={i} className="border-l-2 border-ease-line2 pl-3">
                <p className="text-[12.5px] font-semibold text-slate-200">{h.stage}<span className="ml-2 font-normal text-slate-500">{ist(h.ts)}</span></p>
                {h.note && <p className="text-[12px] text-slate-400">{h.note}</p>}
                {h.actor && <p className="text-[11px] text-slate-600">{h.actor}</p>}
              </li>
            ))}
          </ol>
          {can("note") && (
            <form onSubmit={(e) => { e.preventDefault(); if (note.trim()) { run("note", { text: note.trim() }); setNote(""); } }} className="mt-3 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" data-testid="ops-note-input" className="flex-1 rounded-lg border border-ease-line2 bg-ease-card px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
              <button type="submit" data-testid="ops-note-submit" className={`${btn} border border-ease-line2 text-slate-200 hover:border-ease-sky`}><StickyNote className="h-4 w-4" aria-hidden="true" />Add</button>
            </form>
          )}
          {can("link") && (
            <form onSubmit={(e) => { e.preventDefault(); if (linkCode.trim()) { run("link", { other_code: linkCode.trim().toUpperCase(), reason: reason || null }); setLinkCode(""); } }} className="mt-2 flex gap-2">
              <input value={linkCode} onChange={(e) => setLinkCode(e.target.value)} placeholder="Link possible duplicate (code)" data-testid="ops-link-input" className="flex-1 rounded-lg border border-ease-line2 bg-ease-card px-3 py-2 font-data text-[12.5px] text-slate-200 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
              <button type="submit" data-testid="ops-link-submit" className={`${btn} border border-ease-line2 text-slate-200 hover:border-ease-sky`}>Link</button>
            </form>
          )}
        </div>
        <div className="rounded-2xl border border-ease-line bg-ease-panel p-4" data-testid="ops-replies">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Messages with reporter</h3>
          <div className="mt-3 flex flex-col gap-2">
            {r.replies.length === 0 && <p className="text-[12.5px] text-slate-500">No messages yet.</p>}
            {r.replies.map((m) => (
              <div key={m.id} className={`rounded-lg px-3 py-2 text-[12.5px] ${m.role === "staff" ? "bg-ease-blue/15 text-sky-100" : "bg-ease-card text-slate-300"}`}>
                <span className="text-[10.5px] opacity-70">{m.by} · {ist(m.ts)}</span><p>{m.text}</p>
              </div>
            ))}
          </div>
          {can("note") && (
            <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { run("reply", { text: msg.trim() }); setMsg(""); } }} className="mt-3 flex gap-2">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message the reporter" data-testid="ops-reply-input" className="flex-1 rounded-lg border border-ease-line2 bg-ease-card px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
              <button type="submit" data-testid="ops-reply-submit" className={`${btn} bg-ease-blue text-white hover:bg-[#1D4ED8]`}><MessageSquare className="h-4 w-4" aria-hidden="true" />Send</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ units
function UnitsTab({ can }: { can: (p: string) => boolean }) {
  const qc = useQueryClient();
  const units = useQuery({ queryKey: ["ops-units"], queryFn: () => apiGet<Unit[]>("/ops/units"), refetchInterval: 10000 });
  const set = useMutation({
    mutationFn: ({ id, stat }: { id: string; stat: string }) => apiPost<Unit>(`/ops/units/${id}/status`, { stat }),
    onSuccess: (u) => { toast.success(`${u.id} → ${u.stat}`); qc.invalidateQueries({ queryKey: ["ops-units"] }); qc.invalidateQueries({ queryKey: ["ops-audit"] }); },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <section className="overflow-hidden rounded-2xl border border-ease-line bg-ease-panel" data-testid="ops-units">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead><tr className="border-b border-ease-line text-[10.5px] uppercase tracking-wider text-slate-500">{["Unit", "Service", "Base facility", "Capability", "Status", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ease-line/60">
            {(units.data ?? []).map((u) => (
              <tr key={u.id} data-testid={`ops-unit-row-${u.id}`}>
                <td className="px-4 py-3 font-data text-white">{u.id}</td>
                <td className="px-4 py-3 capitalize text-slate-300">{u.svc}</td>
                <td className="px-4 py-3 text-slate-300">{u.facility}</td>
                <td className="px-4 py-3 text-slate-400">{u.tags}</td>
                <td className={`px-4 py-3 font-semibold ${UNIT_TONE[u.stat] ?? ""}`}>{u.stat}</td>
                <td className="px-4 py-3">
                  {can("unit") ? (
                    <select value={u.stat} onChange={(e) => set.mutate({ id: u.id, stat: e.target.value })} aria-label={`Set status for ${u.id}`} data-testid={`ops-unit-status-${u.id}`}
                      className="rounded-lg border border-ease-line2 bg-ease-card px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none">
                      {Object.keys(UNIT_TONE).map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : <span className="text-[11px] text-slate-600">read-only</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-ease-line px-4 py-2 text-[11px] text-slate-500">Unit locations are their base facilities on the sample graph. No live GPS telemetry is connected.</p>
    </section>
  );
}

// ------------------------------------------------------------------ audit
function AuditTab() {
  const [f, setF] = useState("");
  const audit = useQuery({ queryKey: ["ops-audit", f], queryFn: () => apiGet<AuditEntry[]>(`/ops/audit${f ? `?target=${encodeURIComponent(f)}` : ""}`), refetchInterval: 10000 });
  return (
    <section className="overflow-hidden rounded-2xl border border-ease-line bg-ease-panel" data-testid="ops-audit">
      <div className="flex items-center gap-3 border-b border-ease-line p-3">
        <input value={f} onChange={(e) => setF(e.target.value)} placeholder="Filter by target (e.g. SAMPLE-101)" data-testid="ops-audit-filter" className="w-72 rounded-lg border border-ease-line2 bg-ease-card px-3 py-1.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
        <span className="text-[11px] text-slate-500">Append-only ledger · newest first</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[12.5px]">
          <thead><tr className="border-b border-ease-line text-[10.5px] uppercase tracking-wider text-slate-500">{["#", "Time (IST)", "Actor", "Action", "Target", "Reason", "Before → After"].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ease-line/60">
            {(audit.data ?? []).map((a) => (
              <tr key={a.id} className="text-slate-300" data-testid={`ops-audit-row-${a.n}`}>
                <td className="px-4 py-2.5 font-data text-slate-500">A-{String(a.n).padStart(4, "0")}</td>
                <td className="px-4 py-2.5 text-slate-400">{ist(a.ts)}</td>
                <td className="px-4 py-2.5">{a.actor} <span className="text-slate-500">({a.role})</span></td>
                <td className="px-4 py-2.5 font-medium text-white">{a.action}</td>
                <td className="px-4 py-2.5 font-data">{a.target}</td>
                <td className="px-4 py-2.5 text-slate-400">{a.reason ?? "—"}</td>
                <td className="px-4 py-2.5 font-data text-slate-400">{a.prev || a.next ? `${a.prev ?? "—"} → ${a.next ?? "—"}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.data?.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No audit entries match.</p>}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ analytics
function AnalyticsTab() {
  const a = useQuery({ queryKey: ["ops-analytics"], queryFn: () => apiGet<Analytics>("/ops/analytics"), refetchInterval: 15000 });
  if (!a.data) return <div className="h-40 animate-pulse rounded-2xl bg-ease-panel" />;
  const d = a.data;
  const bars = (obj: Record<string, number>) => {
    const max = Math.max(1, ...Object.values(obj));
    return Object.entries(obj).sort((x, y) => y[1] - x[1]).map(([k, v]) => (
      <div key={k} className="flex items-center gap-3 text-[12.5px]">
        <span className="w-32 shrink-0 truncate text-slate-400">{CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS] ?? k}</span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-ease-card"><span className="block h-full rounded-full bg-ease-sky" style={{ width: `${(v / max) * 100}%` }} /></span>
        <span className="w-6 text-right font-data text-slate-300">{v}</span>
      </div>
    ));
  };
  return (
    <section className="flex flex-col gap-4" data-testid="ops-analytics">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Total incidents", d.total], ["Active", d.active], ["Resolved / closed", d.resolved], ["Avg. time to ack", d.avg_ack_min != null ? `${d.avg_ack_min} min` : "—"], ["Units available", `${d.units_available}/${d.units_total}`]].map(([l, v]) => (
          <div key={l as string} className="rounded-2xl border border-ease-line bg-ease-panel p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{l}</p>
            <p className="mt-1 font-data text-2xl font-bold text-white" data-testid={`ops-metric-${String(l).toLowerCase().replace(/[^a-z]+/g, "-")}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-ease-line bg-ease-panel p-4"><h3 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">By status</h3><div className="flex flex-col gap-2">{bars(d.by_status)}</div></div>
        <div className="rounded-2xl border border-ease-line bg-ease-panel p-4"><h3 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">By severity</h3><div className="flex flex-col gap-2">{bars(d.by_severity)}</div></div>
        <div className="rounded-2xl border border-ease-line bg-ease-panel p-4"><h3 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500">By category</h3><div className="flex flex-col gap-2">{bars(d.by_category)}</div></div>
      </div>
      <p className="text-[11px] text-slate-500">Computed live from the demo database, sample records included. These are not real-world emergency statistics.</p>
    </section>
  );
}

// ------------------------------------------------------------------ users (admin)
function UsersTab() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["ops-users"], queryFn: () => apiGet<UserAdminView[]>("/ops/users") });
  const mut = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body: unknown }) => apiPost<UserAdminView>(`/ops/users/${encodeURIComponent(id)}/${path}`, body),
    onSuccess: () => { toast.success("Account updated"); qc.invalidateQueries({ queryKey: ["ops-users"] }); qc.invalidateQueries({ queryKey: ["ops-audit"] }); },
    onError: (e) => toast.error(errText(e)),
  });
  const staff = (users.data ?? []).filter((u) => u.type === "staff");
  return (
    <section className="overflow-hidden rounded-2xl border border-ease-line bg-ease-panel" data-testid="ops-users">
      <table className="w-full text-left text-[13px]">
        <thead><tr className="border-b border-ease-line text-[10.5px] uppercase tracking-wider text-slate-500">{["Name", "Email", "Role", "Status", ""].map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-ease-line/60">
          {staff.map((u) => (
            <tr key={u.id} data-testid={`ops-user-row-${u.ident}`}>
              <td className="px-4 py-3 text-white">{u.name}</td>
              <td className="px-4 py-3 font-data text-slate-400">{u.ident}</td>
              <td className="px-4 py-3">
                <select value={u.role} onChange={(e) => mut.mutate({ id: u.id, path: "role", body: { role: e.target.value } })} aria-label={`Role for ${u.name}`} data-testid={`ops-user-role-${u.ident}`}
                  className="rounded-lg border border-ease-line2 bg-ease-card px-2 py-1.5 text-[12px] text-slate-200 focus:outline-none">
                  {Object.keys(PERM).map((r) => <option key={r}>{r}</option>)}
                </select>
              </td>
              <td className={`px-4 py-3 text-[12px] font-semibold ${u.disabled ? "text-red-300" : "text-emerald-300"}`}>{u.disabled ? "Disabled" : "Active"}</td>
              <td className="px-4 py-3">
                <button onClick={() => mut.mutate({ id: u.id, path: "disabled", body: { disabled: !u.disabled } })} data-testid={`ops-user-toggle-${u.ident}`}
                  className="rounded-lg border border-ease-line2 px-2.5 py-1.5 text-[12px] text-slate-300 transition hover:border-ease-sky">{u.disabled ? "Enable" : "Disable"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-ease-line px-4 py-2 text-[11px] text-slate-500">At least one active Admin is always required — enforced by the server. Citizen accounts are not listed here.</p>
    </section>
  );
}
