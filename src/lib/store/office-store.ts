"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api, streamAnalysis, type ProviderStatus } from "@/lib/api/client";
import { AGENT_ORDER, AGENTS, isWorking } from "@/lib/domain/agents";
import type {
  AgentId,
  AgentStatus,
  AnalysisMode,
  AnalysisRequest,
  FinalReport,
  Market,
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
  status: AgentStatus | "run_started" | "run_completed" | "run_failed";
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
  | "near_sl_tp";

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

export interface RunState {
  runId: string | null;
  request: AnalysisRequest;
  phase: "running" | "completed" | "failed";
  error?: string;
  startedAt: number;
  reportId?: string;
}

export interface Settings {
  market: Market;
  timezone: string;
  timeframe: Timeframe;
  mode: AnalysisMode;
  accountSize: Record<Market, number>;
  riskPct: number;
  view: "auto" | "3d" | "2d";
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let controller: AbortController | null = null;

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
          case "run_completed": {
            const report = event.report;
            set((s) => ({
              reports: [report, ...s.reports.filter((r) => r.id !== report.id)].slice(0, 50),
              run: s.run ? { ...s.run, phase: "completed", reportId: report.id } : s.run,
              activeAgent: "officer",
            }));
            log({ runId: event.runId, agent: "officer", symbol, status: "run_completed", message: `Laporan final ${report.status.replace("_", " ")} siap.`, at: event.at });
            notifyForReport(report);
            break;
          }
          case "run_failed":
            set((s) => ({ run: s.run ? { ...s.run, phase: "failed", error: event.error } : s.run, activeAgent: event.agent }));
            log({ runId: event.runId, agent: event.agent, symbol, status: "run_failed", message: event.error, at: event.at });
            get().notify({ at: event.at, symbol, kind: "analysis_failed", summary: event.error, urgency: "medium", isDemo: false });
            break;
        }
      };

      const notifyForReport = (r: FinalReport) => {
        const symbol = r.request.symbol;
        const { notify, reports } = get();
        const statusText = r.status.replace("_", " ");
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
        const prev = reports.find(
          (p) => p.id !== r.id && p.request.symbol === symbol && p.request.timeframe === r.request.timeframe,
        );
        if (prev && (prev.status === "BUY_SETUP" || prev.status === "SELL_SETUP") && prev.status !== r.status) {
          notify({ at: r.createdAt, symbol, kind: "scenario_invalid", summary: `Skenario ${prev.status.replace("_", " ")} sebelumnya tidak lagi valid; status terbaru ${statusText}.`, urgency: "high", reportId: r.id, isDemo: r.isDemo });
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
          if (get().run?.phase === "running") return;
          controller?.abort();
          controller = new AbortController();
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
            for await (const event of streamAnalysis(request, controller.signal)) {
              if (lastWorking) {
                const wait = shownAt + MIN_VISIBLE_MS - Date.now();
                if (wait > 0) await sleep(wait);
              }
              apply(event, request.symbol);
              lastWorking = event.type === "agent_status" && isWorking(event.status);
              shownAt = Date.now();
            }
            if (get().run?.phase === "running") {
              set((s) => ({ run: s.run ? { ...s.run, phase: "failed", error: "Koneksi workflow terputus sebelum selesai." } : s.run }));
            }
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            const message = (err as Error).message || "Gagal menghubungi server.";
            set((s) => ({ run: s.run ? { ...s.run, phase: "failed", error: message } : s.run }));
            get().notify({ at: Date.now(), symbol: request.symbol, kind: "analysis_failed", summary: message, urgency: "medium", isDemo: false });
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
      };
    },
    {
      name: "ai-trading-office",
      version: 1,
      // Rehydrated after mount (see StoreHydrator) to avoid SSR mismatches.
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        activity: s.activity.slice(0, 100),
        reports: s.reports,
        watchlist: s.watchlist,
        notifications: s.notifications,
        alerts: s.alerts,
        settings: s.settings,
      }),
    },
  ),
);

export const agentName = (id: AgentId | null) => (id ? AGENTS[id].name : "Office");
