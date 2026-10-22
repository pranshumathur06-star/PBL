import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import type { QueueResponse, Report } from "@/types";

const SOUND_KEY = "ease.ops.sound";
const ACTIVE = ["Reported", "Acknowledged", "Under review", "Assigned", "En route", "On scene"];

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    return ctx;
  } catch {
    return null;
  }
}

// Two-tone attention chime synthesised with Web Audio — no asset to load, no harsh siren.
export function playChime() {
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const t = ac.currentTime;
  [[880, 0], [1175, 0.18], [880, 0.36]].forEach(([f, d]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
    o.connect(g).connect(ac.destination);
    o.start(t + d);
    o.stop(t + d + 0.18);
  });
}

// Watches the Critical queue; anything that appears after the first load raises an alert.
export function useCriticalAlerts() {
  const [alerts, setAlerts] = useState<Report[]>([]);
  const [sound, setSoundState] = useState(() => localStorage.getItem(SOUND_KEY) !== "off");
  const seen = useRef<Set<string> | null>(null);

  const q = useQuery({
    queryKey: ["ops-critical-watch"],
    queryFn: () => apiGet<QueueResponse>("/ops/queue?severity=Critical&sort=new"),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Browsers only allow audio after a user gesture: unlock on the first click/keypress.
  useEffect(() => {
    const unlock = () => { const ac = audio(); if (ac && ac.state === "suspended") void ac.resume(); };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  useEffect(() => {
    const items = q.data?.items;
    if (!items) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((r) => r.code)); // baseline: no alerts for what was already there
      return;
    }
    const fresh = items.filter((r) => !seen.current!.has(r.code) && ACTIVE.includes(r.status));
    items.forEach((r) => seen.current!.add(r.code));
    if (fresh.length) {
      setAlerts((a) => [...fresh, ...a].slice(0, 5));
      if (sound) playChime();
      const base = document.title.replace(/^\(\d+\) /, "");
      document.title = `(${fresh.length}) ${base}`;
    }
  }, [q.data, sound]);

  const setSound = useCallback((on: boolean) => {
    setSoundState(on);
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    if (on) playChime();
  }, []);

  const dismiss = useCallback((code: string) => {
    setAlerts((a) => {
      const next = a.filter((r) => r.code !== code);
      if (!next.length) document.title = document.title.replace(/^\(\d+\) /, "");
      return next;
    });
  }, []);

  return { alerts, dismiss, sound, setSound };
}
