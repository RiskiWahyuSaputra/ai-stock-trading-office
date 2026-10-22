import "server-only";
import { compareCandidates } from "@/lib/agents/entry-planner";
import type { AnalysisMode, FinalReport, Market, ScreenItem, SignalStatus } from "@/lib/domain/schemas";
import { invalidatedText, orderTicketText, signalChanges } from "@/lib/report/order-ticket";
import { runAnalysisWorkflow } from "./engine";
import { runScreener } from "./screener";

/** Radar candidates analysed in full per scan (same as the browser autopilot). */
const MAX_CANDIDATES = 6;

export interface SignalScanConfig {
  market: Market;
  mode: AnalysisMode;
  accountSize: number;
  riskPct: number;
  /** Always analysed, on top of the radar's best candidates. */
  watchlist: string[];
}

/** Last status sent per symbol, so a setup is announced once and its cancellation once. */
export interface SignalStore {
  load(market: Market): Promise<Map<string, SignalStatus>>;
  save(market: Market, changes: Map<string, SignalStatus>): Promise<void>;
}

export interface SignalScanResult {
  scanned: number;
  analysed: string[];
  sent: { symbol: string; type: "ticket" | "invalidated"; status: SignalStatus }[];
  errors: { symbol: string; error: string }[];
}

export function signalConfigFromEnv(env: Record<string, string | undefined> = process.env): SignalScanConfig {
  const num = (v: string | undefined, d: number) => (v && Number(v) > 0 ? Number(v) : d);
  const mode = env.SIGNAL_MODE;
  return {
    market: env.SIGNAL_MARKET === "US" ? "US" : "IDX",
    mode: mode === "conservative" || mode === "aggressive" ? mode : "balanced",
    accountSize: num(env.SIGNAL_ACCOUNT_SIZE, 100_000_000),
    riskPct: Math.min(10, num(env.SIGNAL_RISK_PCT, 1)),
    watchlist: (env.SIGNAL_WATCHLIST ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  };
}

async function analyse(symbol: string, cfg: SignalScanConfig): Promise<FinalReport> {
  for await (const e of runAnalysisWorkflow({ symbol, market: cfg.market, timeframe: "1D", mode: cfg.mode, accountSize: cfg.accountSize, riskPct: cfg.riskPct, origin: "autopilot" })) {
    if (e.type === "run_completed") return e.report;
    if (e.type === "run_failed") throw new Error(e.error);
  }
  throw new Error("Workflow berhenti tanpa laporan.");
}

/**
 * Server-side autopilot round for scheduled jobs: Entry Radar over the whole
 * universe, full five-agent analysis of the best candidates, the watchlist
 * and every symbol with an open setup, then one Telegram message per change.
 */
export async function runSignalScan(cfg: SignalScanConfig, store: SignalStore, send: (text: string) => Promise<void>): Promise<SignalScanResult> {
  const items: ScreenItem[] = [];
  const errors: SignalScanResult["errors"] = [];
  for await (const e of runScreener({ market: cfg.market, mode: cfg.mode, accountSize: cfg.accountSize, riskPct: cfg.riskPct })) {
    if (e.type === "scan_item") items.push(e.item);
    else if (e.type === "scan_error") errors.push({ symbol: e.symbol, error: e.error });
    else if (e.type === "scan_failed") throw new Error(`Entry Radar gagal: ${e.error}`);
  }

  const previous = await store.load(cfg.market);
  const open = [...previous].filter(([, s]) => s === "BUY_SETUP" || s === "SELL_SETUP").map(([sym]) => sym);
  const picked = items
    .filter((i) => i.plan.timing !== "avoid")
    .sort(compareCandidates)
    .slice(0, MAX_CANDIDATES)
    .map((i) => i.stock.symbol);
  const analysed = [...new Set([...picked, ...cfg.watchlist, ...open])];

  const sent: SignalScanResult["sent"] = [];
  const changes = new Map<string, SignalStatus>();
  for (const symbol of analysed) {
    let report: FinalReport;
    try {
      report = await analyse(symbol, cfg);
    } catch (err) {
      errors.push({ symbol, error: err instanceof Error ? err.message : "Kesalahan tidak diketahui." });
      continue;
    }
    const prev = previous.get(symbol);
    for (const type of signalChanges(prev, report)) {
      try {
        await send(type === "ticket" ? orderTicketText(report) : invalidatedText(report, prev!));
        sent.push({ symbol, type, status: report.status });
      } catch (err) {
        errors.push({ symbol, error: err instanceof Error ? err.message : "Gagal mengirim Telegram." });
      }
    }
    // Remember the status only once its message went out, so a failed send is retried next scan.
    const delivered = signalChanges(prev, report).every((t) => sent.some((s) => s.symbol === symbol && s.type === t));
    if (prev !== report.status && delivered) changes.set(symbol, report.status);
  }
  await store.save(cfg.market, changes);
  return { scanned: items.length, analysed, sent, errors };
}
