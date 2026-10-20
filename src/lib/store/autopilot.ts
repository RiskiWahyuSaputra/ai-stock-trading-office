"use client";

import { useEffect } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import { compareCandidates } from "@/lib/agents/entry-planner";
import type { Market } from "@/lib/domain/schemas";
import { marketStatus } from "@/lib/market-hours";
import { prayerTitle } from "@/lib/prayer-times";
import { formatTime } from "@/lib/utils";
import { useOffice } from "./office-store";

/** Radar results older than this are refreshed before the next round. */
export const RADAR_REFRESH_MS = 15 * 60_000;
/** Pause between analyses: short while the exchange trades, longer when nothing moves. */
export const REST_OPEN_MS = 8_000;
export const REST_CLOSED_MS = 25_000;
const RETRY_MS = 60_000;
/** Radar candidates analysed in full per round (on top of the watchlist). */
const MAX_CANDIDATES = 6;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });

/**
 * Work queue for one round: the radar's best candidates first, then the
 * watchlist, so the office always has real work. When nothing qualifies
 * (e.g. the whole market is falling) the least-weak charts are re-checked.
 */
export function buildQueue(market: Market): string[] {
  const { screener, watchlist } = useOffice.getState();
  const items = screener?.request.market === market ? [...screener.items] : [];
  const candidates = items.filter((i) => i.plan.timing !== "avoid").sort(compareCandidates);
  const picked = candidates.slice(0, MAX_CANDIDATES).map((i) => i.stock.symbol);
  const watched = watchlist.filter((w) => w.market === market).map((w) => w.symbol);
  const queue = [...new Set([...picked, ...watched])];
  if (queue.length > 0) return queue;
  return items
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 3)
    .map((i) => i.stock.symbol);
}

/**
 * Office autopilot: scan the market with the Entry Radar, analyse each
 * candidate with the full five-agent workflow, rest, repeat — for as long as
 * the app is open. It yields to the CEO: a manual analysis or scan always
 * runs first, and a manual analysis pre-empts an autopilot one.
 */
async function runAutopilot(signal: AbortSignal) {
  const store = useOffice.getState;
  let queue: string[] = [];
  let index = 0;

  while (!signal.aborted) {
    const s = store();
    const { market, mode, timeframe } = s.settings;
    const reason = s.prayerBreak
      ? `Istirahat jam ${prayerTitle(s.prayerBreak)} sampai ${formatTime(s.prayerBreak.end, undefined, false).slice(0, 5)} — lanjut setelahnya`
      : s.returningUntil && Date.now() < s.returningUntil
        ? "Tim sedang kembali ke meja setelah istirahat"
        : s.run?.phase === "running"
        ? `Mendahulukan tugas CEO: ${s.run.request.symbol}`
        : s.screener?.phase === "running"
          ? "Menunggu scan Entry Radar dari CEO selesai"
          : s.autopilot.holds > 0
            ? "Dijeda sementara: CEO sedang membuka hasil analisisnya"
            : null;
    if (reason) {
      s.setAutopilot({ phase: "waiting", reason });
      await sleep(2_000, signal);
      continue;
    }

    // Start of a round: refresh the radar when it is missing, stale or for another market.
    if (index >= queue.length) {
      const sc = s.screener;
      const stale = !sc || sc.phase !== "completed" || sc.request.market !== market || Date.now() - (sc.finishedAt ?? 0) > RADAR_REFRESH_MS;
      if (stale) {
        s.setAutopilot({ phase: "scanning", symbol: undefined, position: undefined, queueLength: undefined });
        await s.startScreener({ market, mode });
        if (signal.aborted) return;
        if (store().screener?.phase !== "completed") {
          s.setAutopilot({ phase: "resting", nextAt: Date.now() + RETRY_MS });
          await sleep(RETRY_MS, signal);
          continue;
        }
      }
      queue = buildQueue(market);
      index = 0;
      s.setAutopilot({ cycle: store().autopilot.cycle + 1 });
      if (queue.length === 0) {
        s.setAutopilot({ phase: "resting", nextAt: Date.now() + RETRY_MS });
        await sleep(RETRY_MS, signal);
        continue;
      }
    }

    const symbol = queue[index++];
    s.setAutopilot({ phase: "analyzing", symbol, position: index, queueLength: queue.length });
    await store().startAnalysis({ symbol, market, timeframe, mode, origin: "autopilot" });
    if (signal.aborted) return;

    const rest = marketStatus(market).open ? REST_OPEN_MS : REST_CLOSED_MS;
    store().setAutopilot({ phase: "resting", nextAt: Date.now() + rest });
    await sleep(rest, signal);
  }
}

/** Ask the autopilot to hold while `active` (released on unmount). */
export function useAutopilotHold(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const change = (d: number) => {
      const { autopilot, setAutopilot } = useOffice.getState();
      setAutopilot({ holds: Math.max(0, autopilot.holds + d) });
    };
    change(1);
    return () => change(-1);
  }, [active]);
}

/** Runs the autopilot while it is enabled in settings (default on). */
export function useAutopilot() {
  const hydrated = useHydrated();
  const enabled = useOffice((s) => s.settings.autopilot ?? true);

  useEffect(() => {
    if (!hydrated) return;
    if (!enabled) {
      useOffice.getState().setAutopilot({ phase: "off", symbol: undefined });
      return;
    }
    const ctrl = new AbortController();
    void runAutopilot(ctrl.signal);
    return () => {
      ctrl.abort();
      const { run, cancelAnalysis, setAutopilot } = useOffice.getState();
      if (run?.phase === "running" && run.request.origin === "autopilot") cancelAnalysis();
      setAutopilot({ phase: "off", symbol: undefined });
    };
  }, [hydrated, enabled]);
}
