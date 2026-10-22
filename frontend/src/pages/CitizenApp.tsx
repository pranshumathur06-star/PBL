import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Siren, PhoneCall, MapPin, Navigation, ChevronRight, History, Send, XCircle, ShieldAlert,
  CheckCircle2, Clock3, ArrowLeft, LogIn,
} from "lucide-react";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { endSession } from "@/lib/session";
import type { Loc, Report, ReportPublic, Category } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { AREAS } from "@/lib/areas";
import NearbyFacilities from "@/components/viz/NearbyFacilities";

const CATEGORIES: Category[] = ["medical", "accident", "fire", "theft", "flood", "ev", "violence", "other"];
const URGENCIES: { v: "life" | "urgent" | "info"; label: string; hint: string }[] = [
  { v: "life", label: "Life in danger now", hint: "Treated as Critical" },
  { v: "urgent", label: "Urgent, not immediately dangerous", hint: "" },
  { v: "info", label: "Need help, not urgent", hint: "" },
];

function errText(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && err.body !== null && "detail" in err.body) {
    return String((err.body as { detail: unknown }).detail);
  }
  return "Could not reach the demo backend. Your report was not sent — please try again.";
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// The real citizen application — guest reporting first, never gated on auth.
export default function CitizenApp() {
  const { user, isLoading } = useSession();
  const qc = useQueryClient();
  const [view, setView] = useState<"report" | "sent" | "track" | "history">("report");
  const [trackCode, setTrackCode] = useState("");
  const [trackPhone, setTrackPhone] = useState("");
  const [activeCode, setActiveCode] = useState("");

  // ---- report form state ----
  const [category, setCategory] = useState<Category>("medical");
  const [text, setText] = useState("");
  const [urgency, setUrgency] = useState<"life" | "urgent" | "info">("info");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pin, setPin] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsNote, setGpsNote] = useState("");
  const [injuries, setInjuries] = useState("unknown");
  const [people, setPeople] = useState("");
  const [danger, setDanger] = useState(false);
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [sentNode, setSentNode] = useState("");
  const [sentApprox, setSentApprox] = useState(false);

  const grabGps = () => {
    if (!navigator.geolocation) {
      setGpsNote("GPS isn't available on this device — a typed address works just as well.");
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGpsNote("GPS attached (optional — you can clear it or ignore it).");
        setGpsBusy(false);
      },
      () => {
        setGpsNote("GPS blocked or weak — no problem, an address or landmark is enough.");
        setGpsBusy(false);
      },
      { timeout: 8000 },
    );
  };

  const submit = useMutation({
    mutationFn: () =>
      apiPost<Report>("/reports", {
        text: text.trim(),
        category,
        urgency,
        loc: {
          manual: !gps,
          address: address.trim() || null,
          lat: gps?.lat ?? null,
          lng: gps?.lng ?? null,
          accuracy_m: gps?.acc ?? null,
          map_x: AREAS.find((a) => a.id === area)?.x ?? null,
          map_y: AREAS.find((a) => a.id === area)?.y ?? null,
        } satisfies Loc,
        details: { landmark: landmark.trim() || null, pin: pin.trim() || null, injuries, people: people.trim() || null, immediate_danger: danger },
        reporter_name: user && user.type === "citizen" ? user.name : null,
        phone: user && user.type === "citizen" ? null : phone.trim() || null,
      }),
    onSuccess: (rep) => {
      setActiveCode(rep.code);
      setSentNode(rep.node);
      setSentApprox(!area);
      setView("sent");
      toast.success(`Report ${rep.code} received`, { description: "Dispatch has it in the queue. Sending is not a responder en route." });
      qc.invalidateQueries({ queryKey: ["mine"] });
      qc.invalidateQueries({ queryKey: ["report", rep.code] });
    },
    onError: (err) => toast.error(errText(err)),
  });

  const canSubmit = text.trim().length >= 5;

  const mine = useQuery({
    queryKey: ["mine"],
    queryFn: () => apiGet<Report[]>("/reports/mine"),
    enabled: !!user && user.type === "citizen" && view === "history",
    refetchInterval: 15_000,
  });

  const track = useQuery({
    queryKey: ["report", activeCode, trackPhone],
    queryFn: () => apiGet<ReportPublic>(`/reports/${encodeURIComponent(activeCode)}${trackPhone ? `?phone=${encodeURIComponent(trackPhone)}` : ""}`),
    enabled: !!activeCode,
    refetchInterval: 8_000,
    retry: false,
  });

  const cancel = useMutation({
    mutationFn: () => apiPost<Report>(`/reports/${activeCode}/cancel`, { phone: trackPhone || null, reason: "Cancelled by reporter" }),
    onSuccess: () => {
      toast("Report cancelled", { description: "Only you can see this action. If anything changes, call 112." });
      qc.invalidateQueries({ queryKey: ["report", activeCode] });
      qc.invalidateQueries({ queryKey: ["mine"] });
    },
    onError: (err) => toast.error(errText(err)),
  });

  const reply = useMutation({
    mutationFn: (t: string) => apiPost<Report>(`/reports/${activeCode}/reply`, { text: t, phone: trackPhone || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["report", activeCode] }),
    onError: (err) => toast.error(errText(err)),
  });

  const myReports = useMemo(() => mine.data ?? [], [mine.data]);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      {/* app bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0F172A]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white" aria-label="Back to the EASE site">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Site
          </Link>
          <span className="mx-auto flex items-center gap-2 font-heading text-sm font-bold">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-ease-red">
              <Siren className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            </span>
            EASE Citizen
          </span>
          {isLoading ? (
            <span className="w-20" />
          ) : user && user.type === "citizen" ? (
            <button onClick={() => endSession("/login")} data-testid="citizen-app-signout" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-500">
              {user.name.split(" ")[0]} · Sign out
            </button>
          ) : (
            <Link to="/login" data-testid="citizen-app-signin" className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-500">
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
        {/* 112 fallback — always visible, never buried */}
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3" data-testid="citizen-112-callout">
          <p className="flex items-start gap-2 text-[13px] leading-snug text-red-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Immediate danger? EASE is a demo and cannot dispatch help — call 112 first.
          </p>
          <a href="tel:112" className="shrink-0 rounded-xl bg-ease-red px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#BE123C]" data-testid="citizen-112-button">
            Call 112
          </a>
        </div>

        {/* view switcher */}
        <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl border border-slate-800 bg-slate-900/70 p-1" role="tablist" aria-label="Citizen app views">
          {([
            ["report", "Report", "report-tab"],
            ["history", user?.type === "citizen" ? "My reports" : "History", "history-tab"],
            ["track", "Track", "track-tab"],
          ] as const).map(([v, label, tid]) => (
            <button
              key={v}
              role="tab"
              aria-selected={(v === "track" && view === "sent") || view === v}
              onClick={() => { setView(v); if (v === "track" && !activeCode) setActiveCode(""); }}
              data-testid={`citizen-${tid}`}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                (v === "track" && view === "sent") || view === v ? "bg-ease-blue text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---------------- REPORT ---------------- */}
        {view === "report" && (
          <section data-testid="citizen-report-view">
            <h1 className="font-heading text-xl font-extrabold">Report an emergency</h1>
            <p className="mt-1 text-[13px] text-slate-400">No account, OTP or photo needed. Three short steps.</p>

            <div className="mt-5 flex flex-col gap-5">
              <div>
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">1 · What kind of help?</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="citizen-category-grid">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      aria-pressed={category === c}
                      data-testid={`citizen-category-${c}`}
                      className={`rounded-xl border px-3 py-3 text-[12.5px] font-semibold transition ${
                        category === c ? "border-ease-sky bg-ease-sky/10 text-ease-sky" : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">2 · Describe the situation</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  data-testid="citizen-text-input"
                  placeholder="What is happening, where, and who needs help? Plain words are perfect."
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none"
                />
                {text.trim().length > 0 && text.trim().length < 5 && (
                  <p className="mt-1 text-xs text-amber-300">Add a few more words so dispatch understands the situation.</p>
                )}
                <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Urgency">
                  {URGENCIES.map((u) => (
                    <button
                      key={u.v}
                      role="radio"
                      aria-checked={urgency === u.v}
                      onClick={() => setUrgency(u.v)}
                      data-testid={`citizen-urgency-${u.v}`}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition ${
                        urgency === u.v
                          ? u.v === "life" ? "border-ease-red bg-ease-red/10 text-red-100" : "border-ease-sky bg-ease-sky/10 text-sky-100"
                          : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <span className="font-medium">{u.label}</span>
                      {u.hint && <span className="text-[11px] opacity-70">{u.hint}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">3 · Where is it? (optional but helpful)</span>
                <div className="mt-2 flex flex-col gap-3">
                  <button
                    onClick={grabGps}
                    disabled={gpsBusy}
                    data-testid="citizen-gps-button"
                    className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-[13px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    <Navigation className="h-4 w-4" aria-hidden="true" />
                    {gpsBusy ? "Locating…" : gps ? `GPS attached · ±${Math.round(gps.acc)} m (tap to refresh)` : "Attach GPS location (optional)"}
                  </button>
                  {gpsNote && <p className="text-xs text-slate-500">{gpsNote}</p>}
                  <label className="block">
                    <span className="text-[12px] text-slate-400">Nearest area on the sample Dehradun map (for nearby help)</span>
                    <select value={area} onChange={(e) => setArea(e.target.value)} data-testid="citizen-area-select"
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 focus:border-ease-sky focus:outline-none">
                      <option value="">Not sure / skip</option>
                      {AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </label>
                  <input
                    value={address} onChange={(e) => setAddress(e.target.value)} data-testid="citizen-address-input"
                    placeholder="Address or area (e.g. near Clock Tower, Dehradun)"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:border-ease-sky focus:outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={landmark} onChange={(e) => setLandmark(e.target.value)} data-testid="citizen-landmark-input" placeholder="Landmark (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
                    <input value={pin} onChange={(e) => setPin(e.target.value)} data-testid="citizen-pin-input" placeholder="PIN code (optional)" inputMode="numeric" className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
                  </div>
                </div>
              </div>

              <details className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3" data-testid="citizen-details-disclosure">
                <summary className="cursor-pointer text-[13px] font-semibold text-slate-300">Extra details for dispatch (optional)</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[12px] text-slate-400">Injuries</span>
                    <select value={injuries} onChange={(e) => setInjuries(e.target.value)} data-testid="citizen-injuries-select" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-ease-sky focus:outline-none">
                      <option value="unknown">Not sure</option>
                      <option value="none">No injuries</option>
                      <option value="minor">Minor injuries</option>
                      <option value="serious">Serious injuries</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[12px] text-slate-400">People involved</span>
                    <input value={people} onChange={(e) => setPeople(e.target.value)} data-testid="citizen-people-input" placeholder="e.g. 2 adults, 1 child" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
                  </label>
                  <label className="flex items-start gap-2.5 sm:col-span-2">
                    <input type="checkbox" checked={danger} onChange={(e) => setDanger(e.target.checked)} data-testid="citizen-danger-checkbox" className="mt-0.5 h-4 w-4 accent-ease-red" />
                    <span className="text-[13px] text-slate-300">There is still immediate danger (fire spreading, traffic, debris…)</span>
                  </label>
                  {(!user || user.type !== "citizen") && (
                    <label className="block sm:col-span-2">
                      <span className="text-[12px] text-slate-400">Your mobile (optional — lets you cancel and get replies)</span>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" data-testid="citizen-phone-input" placeholder="10-digit mobile" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
                    </label>
                  )}
                </div>
              </details>

              <button
                onClick={() => submit.mutate()}
                disabled={!canSubmit || submit.isPending}
                data-testid="citizen-submit-button"
                className="flex items-center justify-center gap-2 rounded-2xl bg-ease-red py-4 text-base font-extrabold text-white shadow-[0_14px_40px_rgba(225,29,72,0.4)] transition hover:bg-[#BE123C] disabled:opacity-50"
              >
                <Siren className="h-5 w-5" aria-hidden="true" />
                {submit.isPending ? "Sending…" : "Send emergency report"}
              </button>
              <p className="text-center text-[12px] leading-relaxed text-slate-500">
                Sending creates a report for dispatch review. It is <strong className="text-slate-400">not</strong> confirmation
                that a responder is on the way — for immediate danger, call <a href="tel:112" className="font-bold text-slate-300">112</a>.
              </p>
            </div>
          </section>
        )}

        {/* ---------------- SENT ---------------- */}
        {view === "sent" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center" data-testid="citizen-sent-view">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden="true" />
            </span>
            <h1 className="mt-4 font-heading text-xl font-extrabold">Report received by dispatch</h1>
            <p className="mt-3 font-data text-3xl font-extrabold tracking-wider text-ease-sky" data-testid="citizen-sent-code">{activeCode}</p>
            <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-slate-400">
              Save this reference — it is how you check status without an account. Dispatch still
              needs to review the report; nothing moves until a human acts.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setView("track")}
                data-testid="citizen-sent-track-button"
                className="inline-flex items-center gap-2 rounded-xl bg-ease-blue px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
              >
                <History className="h-4 w-4" aria-hidden="true" /> Track this report
              </button>
              <button onClick={() => { setView("report"); setText(""); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500">
                Report something else
              </button>
            </div>
          </section>
        )}
        {view === "sent" && sentNode && (
          <div className="mt-5"><NearbyFacilities node={sentNode} approximate={sentApprox} /></div>
        )}

        {/* ---------------- HISTORY (signed-in) ---------------- */}
        {view === "history" && (
          <section data-testid="citizen-history-view">
            <h1 className="font-heading text-xl font-extrabold">My reports</h1>
            {(!user || user.type !== "citizen") ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
                <p className="text-sm text-slate-400">Report history is for signed-in citizens. Guests can track by reference code in the Track tab.</p>
                <Link to="/login" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ease-blue px-4 py-2.5 text-sm font-bold text-white">Sign in</Link>
              </div>
            ) : mine.isLoading ? (
              <div className="mt-6 flex flex-col gap-3">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-800/70" />)}</div>
            ) : myReports.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
                No reports yet. Anything you send will appear here with its live status.
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3" data-testid="citizen-history-list">
                {myReports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setActiveCode(r.code); setTrackPhone(""); setView("track"); }}
                    data-testid={`citizen-history-item-${r.code}`}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-data text-[12px] text-slate-500">{r.code}</span>
                      <span className={`rounded border px-2 py-0.5 text-[10.5px] font-bold ${
                        r.status === "Reported" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                        : r.status === "Cancelled" ? "border-slate-500/40 bg-slate-500/10 text-slate-300"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13.5px] text-slate-200">{r.text}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />{timeAgo(r.created_at)} · {r.label}
                      {r.unit && <> · unit {r.unit}</>}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------------- TRACK ---------------- */}
        {view === "track" && (
          <section data-testid="citizen-track-view">
            <h1 className="font-heading text-xl font-extrabold">Track a report</h1>
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row">
              <input
                value={activeCode}
                onChange={(e) => setActiveCode(e.target.value.toUpperCase())}
                placeholder="Reference code, e.g. RPT-8F3K2A"
                data-testid="citizen-track-code-input"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-data text-sm tracking-wider text-slate-100 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none"
              />
              <input
                value={trackPhone}
                onChange={(e) => setTrackPhone(e.target.value)}
                placeholder="Your mobile (guests)"
                data-testid="citizen-track-phone-input"
                className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none sm:w-52"
              />
              <button
                onClick={() => { qc.invalidateQueries({ queryKey: ["report", activeCode] }); }}
                data-testid="citizen-track-lookup-button"
                className="rounded-xl bg-ease-blue px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8]"
              >
                Check
              </button>
            </div>

            {activeCode && track.isError && (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-200" data-testid="citizen-track-notfound">
                No report found for that code{trackPhone ? " and mobile number" : ""}. Check the reference — or call 112 if this is urgent.
              </div>
            )}

            {track.data && (
              <div className="mt-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-data text-sm text-slate-400">{track.data.code}</span>
                    <span className="rounded border border-ease-line2 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{track.data.label}</span>
                    <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${
                      track.data.status === "Reported" ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}
                      data-testid="citizen-track-status"
                    >
                      {track.data.status}
                    </span>
                    {track.data.unit && <span className="rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300">Unit {track.data.unit} (simulated)</span>}
                  </div>
                  {track.data.text && <p className="mt-3 text-[13.5px] leading-relaxed text-slate-300">{track.data.text}</p>}
                  {track.data.loc_note && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-slate-500"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{track.data.loc_note}</p>}

                  {/* timeline */}
                  <div className="mt-5 flex flex-col gap-0" data-testid="citizen-track-timeline">
                    {track.data.hist.map((h, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${i === track.data!.hist.length - 1 ? "bg-ease-sky" : "bg-emerald-400"}`} />
                          {i < track.data!.hist.length - 1 && <span className="w-px flex-1 bg-slate-700" />}
                        </div>
                        <div className="pb-4">
                          <p className="text-[13px] font-semibold text-slate-200">{h.stage}</p>
                          {h.note && <p className="text-[12px] text-slate-400">{h.note}</p>}
                          <p className="text-[11px] text-slate-600">{new Date(h.ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* replies */}
                  {track.data.replies.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2" data-testid="citizen-track-replies">
                      {track.data.replies.map((r) => (
                        <div key={r.id} className={`rounded-xl px-3.5 py-2.5 text-[13px] ${r.role === "staff" ? "bg-sky-500/10 text-sky-100" : "bg-slate-800 text-slate-300"}`}>
                          <span className="text-[11px] font-semibold opacity-70">{r.by} · {new Date(r.ts).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                          <p className="mt-0.5">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* actions */}
                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4">
                    {track.data.full && track.data.status && ["Reported", "Acknowledged"].includes(track.data.status) && (
                      <button
                        onClick={() => cancel.mutate()}
                        data-testid="citizen-cancel-button"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/40 py-2.5 text-[13px] font-semibold text-red-300 transition hover:bg-red-500/10"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" /> Cancel this report
                      </button>
                    )}
                    {track.data.full ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const input = (e.currentTarget.elements.namedItem("replyText") as HTMLInputElement);
                          if (input.value.trim()) { reply.mutate(input.value.trim()); input.value = ""; }
                        }}
                        className="flex gap-2"
                        data-testid="citizen-reply-form"
                      >
                        <input name="replyText" data-testid="citizen-reply-input" placeholder="Reply to the command centre…" className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-ease-sky focus:outline-none" />
                        <button type="submit" disabled={reply.isPending} data-testid="citizen-reply-send" className="inline-flex items-center gap-1.5 rounded-xl bg-ease-blue px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60">
                          <Send className="h-4 w-4" aria-hidden="true" /> Send
                        </button>
                      </form>
                    ) : (
                      <p className="text-[12px] leading-relaxed text-slate-500">
                        Guest view: status timeline only. To reply or cancel, enter the mobile number you filed with — or sign in.
                      </p>
                    )}
                  </div>
                </div>
                {track.data.node && <div className="mt-4"><NearbyFacilities node={track.data.node} /></div>}
              </div>
            )}
          </section>
        )}

        <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-[12px] text-slate-600">
          EASE Citizen · demonstration build <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> the command centre sees this instantly
        </p>
      </main>
    </div>
  );
}
