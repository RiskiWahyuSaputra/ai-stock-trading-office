"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toScreenItem } from "@/lib/agents/entry-planner";
import { entryWindow } from "@/lib/market-hours";
import { prayerTitle, type PrayerBreak } from "@/lib/prayer-times";
import { formatTime } from "@/lib/utils";
import { api, streamAnalysis, streamScreener, type ProviderStatus, type TelegramMessage } from "@/lib/api/client";
import { AGENT_ORDER, AGENTS, isWorking } from "@/lib/domain/agents";
import type {
  AgentId,
  AgentStatus,
  AnalysisMode,
  AnalysisRequest,
  FinalReport,
  Market,
  ScreenItem,
  ScreenRequest,
  Timeframe,
  WorkflowEvent,
} from "@/lib/domain/schemas";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface ActivityEntry {
  id: string;
  runId: string;
  agent: AgentId | null;
  symbol: string;
  status: AgentStatus | "run_started" | "run_completed" | "run_failed" | "handoff";
  message: string;
  /** Server timestamp of the underlying event. */
  at: number;
}

export interface AgentState {
  status: AgentStatus;
  progress: number;
  message: string;
  updatedAt: number | null;
  symbol: string | null;
}

export type NotificationKind =
  | "analysis_complete"
  | "report_ready"
  | "analysis_failed"
  | "needs_review"
  | "important_news"
  | "scenario_invalid"
  | "data_delayed"
  | "near_entry"
  | "near_sl_tp"
  | "radar_ready"
  | "prayer_break"
  | "telegram_failed";

export interface AppNotification {
  id: string;
  at: number;
  symbol: string;
  kind: NotificationKind;
  summary: string;
  urgency: "low" | "medium" | "high";
  reportId?: string;
  read: boolean;
  isDemo: boolean;
}

export interface WatchItem {
  symbol: string;
  market: Market;
  addedAt: number;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  reportId: string;
  label: string;
  level: number;
  createdAt: number;
  /** Alerts only fire with a live price feed; in DEMO they stay inactive. */
  active: boolean;
  inactiveReason?: string;
}

/** The latest agent-to-agent handoff, animated in the office. */
export interface Handoff {
  id: string;
  from: AgentId;
  to: AgentId;
  message: string;
  symbol: string;
  at: number;
}

export interface AutopilotState {
  phase: "off" | "scanning" | "analyzing" | "resting" | "waiting";
  symbol?: string;
  /** Position in the current work queue (1-based) and its length. */
  position?: number;
  queueLength?: number;
  nextAt?: number;
  /** Why the autopilot is waiting (shown in the office). */
  reason?: string;
  cycle: number;
  /** Screens that ask the autopilot to hold (e.g. the CEO reading their own analysis). */
  holds: number;
}

export interface RunState {
  runId: string | null;
  request: AnalysisRequest;
  phase: "running" | "completed" | "failed";
  error?: string;
  startedAt: number;
  reportId?: string;
}

export interface ScreenerState {
  scanId: string | null;
  request: ScreenRequest;
  phase: "running" | "completed" | "failed";
  done: number;
  total: number;
  /** Exchange-local trading days the plans refer to. */
  today: string | null;
  nextDay: string | null;
  sessionLabel: string | null;
  items: ScreenItem[];
  errors: { symbol: string; error: string }[];
  error?: string;
  isDemo: boolean;
  startedAt: number;
  finishedAt?: number;
}

export interface PrayerSettings {
  enabled: boolean;
  cityId: string;
  minutes: number;
}

export const DEFAULT_PRAYER: PrayerSettings = { enabled: true, cityId: "jakarta", minutes: 15 };

export interface Settings {
  market: Market;
  timezone: string;
  timeframe: Timeframe;
  mode: AnalysisMode;
  accountSize: Record<Market, number>;
  riskPct: number;
  view: "auto" | "3d" | "2d";
  /** Entry Radar rescans on its own while its page is open and the market is in session. */
  autoScan?: boolean;
  /** The office works on its own (radar + analyses) while the app is open. Default on. */
  autopilot?: boolean;
  /** Prayer breaks at the five daily prayer times. Default on, Jakarta, 15 minutes. */
  prayer?: PrayerSettings;
  /** Send BUY/SELL setups as order tickets to Telegram (when the server has a bot configured). Default on. */
  telegram?: boolean;
}

interface OfficeState {
  agents: Record<AgentId, AgentState>;
  activity: ActivityEntry[];
  run: RunState | null;
  activeAgent: AgentId | null;
  selectedAgent: AgentId | null;
  reports: FinalReport[];
  watchlist: WatchItem[];
  notifications: AppNotification[];
  alerts: PriceAlert[];
  screener: ScreenerState | null;
  handoff: Handoff | null;
  autopilot: AutopilotState;
  /** The prayer break in progress, if any (set by the prayer schedule). */
  prayerBreak: PrayerBreak | null;
  /** A CEO task requested during a prayer break, started when the break ends. */
  queuedTask: AnalysisRequest | null;
  /** After a break the team walks back to their desks until this time. */
  returningUntil: number | null;
  /** The latest BUY SETUP the team produced — the only result they celebrate. */
  celebration: { reportId: string; symbol: string; at: number } | null;
  settings: Settings;
  provider: { status: ProviderStatus | null; ok: boolean; checkedAt: number | null; error?: string };

  startAnalysis: (req: AnalysisRequest) => Promise<void>;
  cancelAnalysis: () => void;
  selectAgent: (id: AgentId | null) => void;
  toggleWatch: (symbol: string, market: Market) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearNotifications: () => void;
  notify: (n: Omit<AppNotification, "id" | "read">) => void;
  updateSettings: (s: Partial<Settings>) => void;
  checkProvider: () => Promise<void>;
  createAlerts: (report: FinalReport) => number;
  removeAlert: (id: string) => void;
  deleteReport: (id: string) => void;
  startScreener: (req: Pick<ScreenRequest, "market" | "mode" | "symbols">) => Promise<void>;
  cancelScreener: () => void;
  /** Store a radar candidate's report with the other final reports; returns its id. */
  saveScreenReport: (item: ScreenItem) => string | null;
  setAutopilot: (p: Partial<AutopilotState>) => void;
  setPrayerBreak: (b: PrayerBreak | null) => void;
  /** Run now, or — during a prayer break — queue until the team is back. */
  requestAnalysis: (req: AnalysisRequest) => void;
  clearQueuedTask: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const idleAgents = (): Record<AgentId, AgentState> =>
  Object.fromEntries(
    AGENT_ORDER.map((id) => [id, { status: "idle", progress: 0, message: "Menunggu tugas.", updatedAt: null, symbol: null }]),
  ) as Record<AgentId, AgentState>;

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

/**
 * Minimum on-screen time for a working status. The server timestamps stay
 * untouched — this only keeps fast stages visible long enough to follow.
 */
const MIN_VISIBLE_MS = 900;
/** Longest walk from the coffee corner back to a desk, plus sitting down. */
const RETURN_WALK_MS = 20_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let controller: AbortController | null = null;
let screenController: AbortController | null = null;

const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

/* ------------------------------------------------------------------ */
/* Store                                                                */
/* ------------------------------------------------------------------ */

export const useOffice = create<OfficeState>()(
  persist(
    (set, get) => {
      const log = (e: Omit<ActivityEntry, "id">) =>
        set((s) => ({ activity: [{ ...e, id: uid() }, ...s.activity].slice(0, 200) }));

      const apply = (event: WorkflowEvent, symbol: string) => {
        switch (event.type) {
          case "run_started":
            set((s) => ({ run: s.run ? { ...s.run, runId: event.runId } : s.run }));
            log({ runId: event.runId, agent: null, symbol, status: "run_started", message: `Analisis ${symbol} (${event.request.timeframe}, ${event.request.mode}) dimulai.`, at: event.at });
            break;
          case "agent_status":
            set((s) => ({
              agents: {
                ...s.agents,
                [event.agent]: { status: event.status, progress: event.progress, message: event.message, updatedAt: event.at, symbol },
              },
              activeAgent: isWorking(event.status) ? event.agent : s.activeAgent,
            }));
            if (event.status !== "queued") {
              log({ runId: event.runId, agent: event.agent, symbol, status: event.status, message: event.message, at: event.at });
            }
            break;
          case "handoff":
            set({ handoff: { id: uid(), from: event.from, to: event.to, message: event.message, symbol, at: event.at } });
            log({ runId: event.runId, agent: event.from, symbol, status: "handoff", message: `→ ${AGENTS[event.to].name}: ${event.message}`, at: event.at });
            break;
          case "run_completed": {
            const report = event.report;
            // Autopilot keeps only its newest report per symbol & timeframe so it never floods history.
            const superseded = (r: FinalReport) =>
              r.id === report.id ||
              (report.request.origin === "autopilot" &&
                r.request.origin === "autopilot" &&
                r.request.symbol === report.request.symbol &&
                r.request.timeframe === report.request.timeframe);
            if (report.status === "BUY_SETUP") set({ celebration: { reportId: report.id, symbol: report.request.symbol, at: event.at } });
            set((s) => ({
              reports: [report, ...s.reports.filter((r) => !superseded(r))].slice(0, 50),
              run: s.run ? { ...s.run, phase: "completed", reportId: report.id } : s.run,
              activeAgent: "officer",
            }));
            log({ runId: event.runId, agent: "officer", symbol, status: "run_completed", message: `Laporan final ${report.status.replace("_", " ")} siap.`, at: event.at });
            mergeIntoRadar(report);
            notifyForReport(report);
            break;
          }
          case "run_failed":
            set((s) => ({ run: s.run ? { ...s.run, phase: "failed", error: event.error } : s.run, activeAgent: event.agent }));
            log({ runId: event.runId, agent: event.agent, symbol, status: "run_failed", message: event.error, at: event.at });
            if (get().run?.request.origin !== "autopilot") {
              get().notify({ at: event.at, symbol, kind: "analysis_failed", summary: event.error, urgency: "medium", isDemo: false });
            }
            break;
        }
      };

      /**
       * A newer daily analysis of a radar symbol (autopilot or CEO) replaces its
       * scan row, so a BUY found between scans shows up in the Entry Radar at once.
       * Only comparable runs merge: same market, daily timeframe, same risk profile.
       */
      const mergeIntoRadar = (report: FinalReport) => {
        const sc = get().screener;
        const req = report.request;
        if (!sc || sc.phase === "running" || sc.request.market !== req.market || req.timeframe !== "1D" || sc.request.mode !== req.mode) return;
        const item: ScreenItem = {
          ...toScreenItem(report, entryWindow(req.market)),
          refreshedBy: req.origin ?? "manual",
          refreshedAt: report.createdAt,
        };
        const items = sc.items.some((i) => i.stock.symbol === req.symbol)
          ? sc.items.map((i) => (i.stock.symbol === req.symbol ? item : i))
          : [...sc.items, item];
        set({ screener: { ...sc, items } });
        const before = sc.items.find((i) => i.stock.symbol === req.symbol)?.plan.timing;
        if (before !== item.plan.timing) {
          log({ runId: report.id, agent: "officer", symbol: req.symbol, status: "handoff", message: `→ Entry Radar: ${before ? `${before.replace("_", " ")} → ` : ""}${item.plan.timing.replace("_", " ")}. ${item.plan.headline}`, at: report.createdAt });
        }
      };

      /** Each screened symbol updates the desks that really worked on it. */
      const radarAgents = (item: ScreenItem, done: number, total: number, at: number) => {
        const progress = Math.round((done / total) * 100);
        const symbol = item.stock.symbol;
        const dir = { bullish: "naik", bearish: "turun", neutral: "netral" }[item.direction];
        const a = (status: AgentStatus, message: string): AgentState => ({ status, progress, message, updatedAt: at, symbol });
        const r = item.report;
        set((s) => ({
          agents: {
            ...s.agents,
            technical: a("analyzing", `Radar ${done}/${total} · ${symbol}: tren ${dir} (${item.trendScore.toFixed(2)}).`),
            ...(r && {
              news: a("researching", `Radar · ${symbol}: ${r.news.summary}`),
              risk: a("risk_checking", `Radar · ${symbol}: status ${r.risk.status}${r.risk.riskReward.length ? `, R/R ${r.risk.riskReward.map((x) => x.toFixed(1)).join("/")}` : ""}.`),
              reviewer: a("reviewing", `Radar · ${symbol}: ${r.review.verdict.replace("_", " ")} → ${item.plan.timing.replace("_", " ")}.`),
            }),
          },
        }));
      };

      const radarSummary = (scanId: string, at: number) => {
        const sc = get().screener;
        if (!sc) return;
        const count = (t: ScreenItem["plan"]["timing"]) => sc.items.filter((i) => i.plan.timing === t).length;
        const summary = `${count("today")} entry hari ini, ${count("next_session")} sesi berikutnya, ${count("later")} dipantau dari ${sc.items.length} saham.`;
        const done = (status: AgentStatus, message: string): AgentState => ({ status, progress: 100, message, updatedAt: at, symbol: "RADAR" });
        set((s) => ({
          agents: {
            news: { ...s.agents.news, status: "completed", progress: 100 },
            technical: done("completed", `Radar selesai: ${sc.items.length} grafik dibaca.`),
            risk: { ...s.agents.risk, status: "completed", progress: 100 },
            reviewer: { ...s.agents.reviewer, status: "completed", progress: 100 },
            officer: done("completed", `Radar ${sc.request.market}: ${summary}`),
          },
          activeAgent: "officer",
          handoff: { id: uid(), from: "technical", to: "officer", message: summary, symbol: "RADAR", at },
        }));
        log({ runId: scanId, agent: "technical", symbol: "RADAR", status: "handoff", message: `→ ${AGENTS.officer.name}: ${summary}`, at });
        log({ runId: scanId, agent: "officer", symbol: "RADAR", status: "run_completed", message: `Entry Radar ${sc.request.market} selesai: ${summary}`, at });
      };

      let lastRadarNotice = "";
      const notifyForScan = () => {
        const sc = get().screener;
        if (!sc) return;
        const list = (t: ScreenItem["plan"]["timing"]) => sc.items.filter((i) => i.plan.timing === t).map((i) => i.stock.symbol);
        const today = list("today");
        const next = list("next_session");
        if (today.length === 0 && next.length === 0) return;
        // Repeated scans with the same candidates stay quiet.
        const key = `${sc.request.market}|${today.join()}|${next.join()}`;
        if (key === lastRadarNotice) return;
        lastRadarNotice = key;
        const parts = [
          today.length ? `${today.length} bisa entry hari ini (${today.slice(0, 4).join(", ")})` : "",
          next.length ? `${next.length} untuk sesi berikutnya (${next.slice(0, 4).join(", ")})` : "",
        ].filter(Boolean);
        get().notify({ at: Date.now(), symbol: "RADAR", kind: "radar_ready", summary: `Entry Radar ${sc.request.market}: ${parts.join("; ")}.`, urgency: today.length ? "high" : "medium", isDemo: sc.isDemo });
      };

      /**
       * Autopilot order ticket to Telegram; the CEO places the order in their broker app by hand.
       * When the scheduled server scan is set up it sends these, so the browser stays quiet.
       */
      const pushTelegram = (msg: TelegramMessage) => {
        const { provider, settings } = get();
        const tg = provider.status?.telegram;
        if (!tg?.enabled || tg.server || settings.telegram === false) return;
        api.telegram(msg).catch((err: Error) => {
          get().notify({ at: Date.now(), symbol: msg.type === "test" ? "TELEGRAM" : msg.report.request.symbol, kind: "telegram_failed", summary: err.message, urgency: "medium", isDemo: false });
        });
      };

      const notifyForReport = (r: FinalReport) => {
        const symbol = r.request.symbol;
        const { notify, reports } = get();
        const statusText = r.status.replace("_", " ");
        const prev = reports.find(
          (p) => p.id !== r.id && p.request.symbol === symbol && p.request.timeframe === r.request.timeframe,
        );
        if (r.request.origin === "autopilot") {
          // Background work only speaks up when something changed: a new setup, or a setup that broke.
          const actionable = (x?: FinalReport) => x?.status === "BUY_SETUP" || x?.status === "SELL_SETUP";
          if (actionable(r) && prev?.status !== r.status) {
            notify({ at: r.createdAt, symbol, kind: "report_ready", summary: `Autopilot: ${statusText} baru — ${r.request.timeframe}, konfluensi ${r.confidence.score}/100.`, urgency: "high", reportId: r.id, isDemo: r.isDemo });
            pushTelegram({ type: "ticket", report: r });
          }
          if (prev && actionable(prev) && prev.status !== r.status) {
            notify({ at: r.createdAt, symbol, kind: "scenario_invalid", summary: `Skenario ${prev.status.replace("_", " ")} sebelumnya tidak lagi valid; status terbaru ${statusText}.`, urgency: "high", reportId: r.id, isDemo: r.isDemo });
            pushTelegram({ type: "invalidated", report: r, previous: prev.status });
          }
          return;
        }
        notify({
          at: r.createdAt,
          symbol,
          kind: "report_ready",
          summary: `${statusText} — ${r.request.timeframe}, konfluensi ${r.confidence.score}/100.`,
          urgency: r.status === "BUY_SETUP" || r.status === "SELL_SETUP" ? "medium" : "low",
          reportId: r.id,
          isDemo: r.isDemo,
        });
        if (r.review.verdict === "conflicting" || r.review.verdict === "needs_review") {
          notify({ at: r.createdAt, symbol, kind: "needs_review", summary: r.review.conflicts[0] ?? "Analisis memerlukan review tambahan sebelum dapat ditindaklanjuti.", urgency: "medium", reportId: r.id, isDemo: r.isDemo });
        }
        if (r.review.verdict === "insufficient_data") {
          notify({ at: r.createdAt, symbol, kind: "data_delayed", summary: "Data tidak cukup atau kedaluwarsa — tidak ada sinyal yang diterbitkan.", urgency: "high", reportId: r.id, isDemo: r.isDemo });
        }
        const important = r.news.items.find((i) => i.impact === "high" && i.sentiment === "negative");
        if (important) {
          notify({ at: r.createdAt, symbol, kind: "important_news", summary: important.headline, urgency: "medium", reportId: r.id, isDemo: important.source.isDemo });
        }
        // Officer: previous actionable scenario on the same symbol/timeframe no longer holds.
        if (prev && (prev.status === "BUY_SETUP" || prev.status === "SELL_SETUP") && prev.status !== r.status) {
          notify({ at: r.createdAt, symbol, kind: "scenario_invalid", summary: `Skenario ${prev.status.replace("_", " ")} sebelumnya tidak lagi valid; status terbaru ${statusText}.`, urgency: "high", reportId: r.id, isDemo: r.isDemo });
          pushTelegram({ type: "invalidated", report: r, previous: prev.status });
        }
      };

      return {
        agents: idleAgents(),
        activity: [],
        run: null,
        activeAgent: null,
        selectedAgent: null,
        reports: [],
        watchlist: [
          { symbol: "BBCA", market: "IDX", addedAt: 0 },
          { symbol: "TLKM", market: "IDX", addedAt: 0 },
          { symbol: "NVDA", market: "US", addedAt: 0 },
        ],
        notifications: [],
        alerts: [],
        screener: null,
        handoff: null,
        autopilot: { phase: "off", cycle: 0, holds: 0 },
        prayerBreak: null,
        queuedTask: null,
        returningUntil: null,
        celebration: null,
        settings: {
          market: "IDX",
          timezone: "Asia/Jakarta",
          timeframe: "1D",
          mode: "balanced",
          accountSize: { IDX: 100_000_000, US: 10_000 },
          riskPct: 1,
          view: "auto",
        },
        provider: { status: null, ok: false, checkedAt: null },

        async startAnalysis(req) {
          const current = get().run;
          if (current?.phase === "running") {
            // The CEO's own task always takes priority over background work.
            if (current.request.origin !== "autopilot" || req.origin === "autopilot") return;
            get().cancelAnalysis();
          }
          controller?.abort();
          controller = new AbortController();
          const signal = controller.signal;
          const { settings } = get();
          const request: AnalysisRequest = {
            ...req,
            accountSize: req.accountSize ?? settings.accountSize[req.market],
            riskPct: req.riskPct ?? settings.riskPct,
          };
          set({ agents: idleAgents(), activeAgent: null, run: { runId: null, request, phase: "running", startedAt: Date.now() } });
          let shownAt = 0;
          let lastWorking = false;
          try {
            for await (const event of streamAnalysis(request, signal)) {
              if (lastWorking) {
                const wait = shownAt + MIN_VISIBLE_MS - Date.now();
                if (wait > 0) await sleep(wait);
              }
              // A newer run may have replaced this one while we waited.
              if (signal.aborted) return;
              apply(event, request.symbol);
              lastWorking = (event.type === "agent_status" && isWorking(event.status)) || event.type === "handoff";
              shownAt = Date.now();
            }
            if (get().run?.phase === "running") {
              set((s) => ({ run: s.run ? { ...s.run, phase: "failed", error: "Koneksi workflow terputus sebelum selesai." } : s.run }));
            }
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            const message = (err as Error).message || "Gagal menghubungi server.";
            set((s) => ({ run: s.run ? { ...s.run, phase: "failed", error: message } : s.run }));
            if (request.origin !== "autopilot") get().notify({ at: Date.now(), symbol: request.symbol, kind: "analysis_failed", summary: message, urgency: "medium", isDemo: false });
          }
        },

        cancelAnalysis() {
          controller?.abort();
          controller = null;
          set((s) => ({
            run: s.run ? { ...s.run, phase: "failed", error: "Dibatalkan oleh pengguna." } : null,
            agents: Object.fromEntries(
              Object.entries(s.agents).map(([k, a]) => [k, isWorking(a.status) || a.status === "queued" ? { ...a, status: "idle", message: "Dibatalkan." } : a]),
            ) as Record<AgentId, AgentState>,
            activeAgent: null,
          }));
        },

        selectAgent: (id) => set({ selectedAgent: id }),

        toggleWatch: (symbol, market) =>
          set((s) => ({
            watchlist: s.watchlist.some((w) => w.symbol === symbol)
              ? s.watchlist.filter((w) => w.symbol !== symbol)
              : [...s.watchlist, { symbol, market, addedAt: Date.now() }],
          })),

        notify: (n) => set((s) => ({ notifications: [{ ...n, id: uid(), read: false }, ...s.notifications].slice(0, 100) })),
        markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
        markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        clearNotifications: () => set({ notifications: [] }),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        async checkProvider() {
          try {
            const status = await api.status();
            set({ provider: { status, ok: true, checkedAt: Date.now() } });
          } catch (err) {
            set((s) => ({ provider: { ...s.provider, ok: false, checkedAt: Date.now(), error: (err as Error).message } }));
          }
        },

        createAlerts(report) {
          if (!report.entryZone || report.stopLoss === null) return 0;
          const live = get().provider.status?.supportsLivePrices ?? false;
          const inactiveReason = live ? undefined : "Tidak ada feed harga live (mode DEMO) — alert disimpan tetapi tidak aktif.";
          const levels: [string, number][] = [
            ["Entry zone", report.entryZone.high],
            ["Stop loss", report.stopLoss],
            ...report.takeProfits.map((tp, i) => [`TP${i + 1}`, tp] as [string, number]),
          ];
          const alerts: PriceAlert[] = levels.map(([label, level]) => ({
            id: uid(),
            symbol: report.request.symbol,
            reportId: report.id,
            label,
            level,
            createdAt: Date.now(),
            active: live,
            inactiveReason,
          }));
          set((s) => ({ alerts: [...alerts, ...s.alerts.filter((a) => a.reportId !== report.id)] }));
          return alerts.length;
        },
        removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
        deleteReport: (id) => set((s) => ({ reports: s.reports.filter((r) => r.id !== id) })),

        async startScreener(req) {
          if (get().screener?.phase === "running") return;
          screenController?.abort();
          screenController = new AbortController();
          const { settings } = get();
          const request: ScreenRequest = { ...req, accountSize: settings.accountSize[req.market], riskPct: settings.riskPct };
          const patch = (p: Partial<ScreenerState>) => set((s) => ({ screener: s.screener ? { ...s.screener, ...p } : s.screener }));
          set({
            screener: {
              scanId: null,
              request,
              phase: "running",
              done: 0,
              total: req.symbols?.length ?? 0,
              today: null,
              nextDay: null,
              sessionLabel: null,
              items: [],
              errors: [],
              isDemo: false,
              startedAt: Date.now(),
            },
          });
          try {
            for await (const e of streamScreener(request, screenController.signal)) {
              const cur = get().screener;
              if (!cur) return;
              const officeFree = get().run?.phase !== "running";
              switch (e.type) {
                case "scan_started":
                  patch({ scanId: e.scanId, total: e.total, today: e.today, nextDay: e.nextDay, sessionLabel: e.sessionLabel });
                  if (officeFree) {
                    set({ agents: idleAgents(), activeAgent: "technical" });
                    log({ runId: e.scanId, agent: null, symbol: "RADAR", status: "run_started", message: `Entry Radar memindai ${e.total} saham ${req.market}.`, at: e.at });
                  }
                  break;
                case "scan_item": {
                  patch({ done: e.done, total: e.total, items: [...cur.items, e.item], isDemo: cur.isDemo || !!e.item.report?.isDemo });
                  if (officeFree) radarAgents(e.item, e.done, e.total, e.at);
                  break;
                }
                case "scan_error":
                  patch({ done: e.done, total: e.total, errors: [...cur.errors, { symbol: e.symbol, error: e.error }] });
                  break;
                case "scan_completed":
                  patch({ phase: "completed", finishedAt: e.at, isDemo: e.sources.some((x) => x.isDemo) });
                  if (officeFree) radarSummary(e.scanId, e.at);
                  notifyForScan();
                  break;
                case "scan_failed":
                  patch({ phase: "failed", error: e.error, finishedAt: e.at });
                  get().notify({ at: e.at, symbol: "RADAR", kind: "analysis_failed", summary: `Entry Radar gagal: ${e.error}`, urgency: "medium", isDemo: false });
                  break;
              }
            }
            if (get().screener?.phase === "running") patch({ phase: "failed", error: "Koneksi scan terputus sebelum selesai." });
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            patch({ phase: "failed", error: (err as Error).message || "Gagal menghubungi server." });
          }
        },

        cancelScreener() {
          screenController?.abort();
          screenController = null;
          set((s) => ({ screener: s.screener?.phase === "running" ? { ...s.screener, phase: "failed", error: "Dibatalkan oleh pengguna." } : s.screener }));
        },

        setAutopilot: (p) => set((s) => ({ autopilot: { ...s.autopilot, ...p } })),

        setPrayerBreak(b) {
          const prev = get().prayerBreak;
          if (prev?.start === b?.start && prev?.name === b?.name) return;
          set({ prayerBreak: b });
          if (b) {
            const until = formatTime(b.end, undefined, false).slice(0, 5);
            log({ runId: `prayer-${b.start}`, agent: null, symbol: "KANTOR", status: "run_started", message: `Waktu ${prayerTitle(b)} — tim istirahat dulu (ngopi & jalan-jalan) sampai ${until}.`, at: b.start });
            get().notify({ at: b.start, symbol: "KANTOR", kind: "prayer_break", summary: `Waktu ${prayerTitle(b)} (${formatTime(b.start, undefined, false).slice(0, 5)}). Tim istirahat sampai ${until}.`, urgency: "low", isDemo: false });
          } else if (prev) {
            set({ returningUntil: Date.now() + RETURN_WALK_MS });
            log({ runId: `prayer-${prev.start}`, agent: null, symbol: "KANTOR", status: "run_completed", message: `Istirahat ${prayerTitle(prev)} selesai — tim kembali ke meja.`, at: Date.now() });
            const task = get().queuedTask;
            if (task) {
              set({ queuedTask: null });
              // Start once everyone is back at their desk.
              setTimeout(() => void get().startAnalysis(task), RETURN_WALK_MS);
            }
          }
        },

        requestAnalysis(req) {
          if (get().prayerBreak && req.origin !== "autopilot") set({ queuedTask: req });
          else void get().startAnalysis(req);
        },
        clearQueuedTask: () => set({ queuedTask: null }),

        saveScreenReport(item) {
          const report = item.report;
          if (!report) return null;
          set((s) => ({ reports: [report, ...s.reports.filter((r) => r.id !== report.id)].slice(0, 50) }));
          return report.id;
        },
      };
    },
    {
      name: "ai-trading-office",
      version: 1,
      // Rehydrated after mount (see StoreHydrator) to avoid SSR mismatches.
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : window.localStorage)),
      partialize: (s) => ({
        activity: s.activity.slice(0, 100),
        reports: s.reports,
        watchlist: s.watchlist,
        notifications: s.notifications,
        alerts: s.alerts,
        screener: s.screener?.phase === "running" ? null : s.screener,
        settings: s.settings,
      }),
    },
  ),
);

export const agentName = (id: AgentId | null) => (id ? AGENTS[id].name : "Office");
