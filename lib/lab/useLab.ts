"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LAB_URL, hello, LabError, status, type LabConfig, type LabStatus } from "./client.ts";

const KEY = "jifunze:lab";
const POLL_MS = 15_000;

export type LabPhase = "checking" | "absent" | "unpaired" | "ready";
export type LabState = { phase: LabPhase; config: LabConfig; status?: LabStatus; problem?: "wrong-code" | "origin" };

function loadConfig(): LabConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw) as Partial<LabConfig>;
      return { url: typeof c.url === "string" && c.url ? c.url : DEFAULT_LAB_URL, token: typeof c.token === "string" ? c.token : "" };
    }
  } catch {
    /* storage unavailable */
  }
  return { url: DEFAULT_LAB_URL, token: "" };
}

function saveConfig(c: LabConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable: pairing lasts for this page only */
  }
}

const SERVER: LabState = { phase: "checking", config: { url: DEFAULT_LAB_URL, token: "" } };
let state: LabState | null = null;
const listeners = new Set<() => void>();

function get(): LabState {
  if (state === null) state = { phase: "checking", config: loadConfig() };
  return state;
}

function set(next: LabState): void {
  state = next;
  for (const l of listeners) l();
}

export async function refreshLab(): Promise<void> {
  const current = get();
  const { config } = current;
  if (!config.token) {
    set({ ...current, phase: (await hello(config.url)) ? "unpaired" : "absent", status: undefined });
    return;
  }
  try {
    set({ phase: "ready", config, status: await status(config) });
  } catch (e) {
    const kind = e instanceof LabError ? e.kind : "server";
    if (kind === "unauthorized") set({ phase: "unpaired", config, problem: current.problem });
    else if (kind === "forbidden") set({ phase: "absent", config, problem: "origin" });
    else set({ phase: "absent", config });
  }
}

export async function pairLab(code: string, url?: string): Promise<boolean> {
  const config = { url: (url || get().config.url).trim() || DEFAULT_LAB_URL, token: code.trim() };
  try {
    const s = await status(config);
    saveConfig(config);
    set({ phase: "ready", config, status: s });
    return true;
  } catch (e) {
    const kind = e instanceof LabError ? e.kind : "server";
    set({ ...get(), phase: kind === "unauthorized" ? "unpaired" : "absent", problem: kind === "unauthorized" ? "wrong-code" : undefined });
    return false;
  }
}

export function forgetLab(): void {
  const config = { url: get().config.url, token: "" };
  saveConfig(config);
  set({ phase: "checking", config });
  void refreshLab();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLab(): LabState {
  const s = useSyncExternalStore(subscribe, get, () => SERVER);
  useEffect(() => {
    void refreshLab();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshLab();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refreshLab();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return s;
}
