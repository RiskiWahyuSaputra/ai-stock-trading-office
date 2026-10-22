import { z } from "zod";
import {
  CandleSeriesSchema,
  DataSourceSchema,
  NewsReportSchema,
  QuoteSchema,
  ScreenEventSchema,
  StockInfoSchema,
  WorkflowEventSchema,
  type AnalysisRequest,
  type FinalReport,
  type Market,
  type ScreenEvent,
  type ScreenRequest,
  type SignalStatus,
  type Timeframe,
  type WorkflowEvent,
} from "@/lib/domain/schemas";

/** Browser-side API client. Every response is validated before use. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(url: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status);
  return schema.parse(body);
}

export const ProviderStatusSchema = z.object({
  market: DataSourceSchema,
  news: DataSourceSchema,
  supportsLivePrices: z.boolean(),
  llm: z.object({ enabled: z.boolean(), note: z.string() }),
  telegram: z.object({ enabled: z.boolean() }).default({ enabled: false }),
  serverTime: z.number(),
});
export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;

export const api = {
  status: (signal?: AbortSignal) => getJson("/api/status", ProviderStatusSchema, signal),
  symbols: (q: string, market?: Market, signal?: AbortSignal) =>
    getJson(
      `/api/symbols?${new URLSearchParams({ q, ...(market ? { market } : {}) })}`,
      z.object({ results: z.array(StockInfoSchema), source: DataSourceSchema }),
      signal,
    ),
  quote: (symbol: string, market: Market, signal?: AbortSignal) =>
    getJson(`/api/quote?${new URLSearchParams({ symbol, market })}`, QuoteSchema, signal),
  candles: (symbol: string, market: Market, timeframe: Timeframe, limit = 120, signal?: AbortSignal) =>
    getJson(
      `/api/candles?${new URLSearchParams({ symbol, market, timeframe, limit: String(limit) })}`,
      CandleSeriesSchema,
      signal,
    ),
  news: (symbol: string, market: Market, signal?: AbortSignal) =>
    getJson(`/api/news?${new URLSearchParams({ symbol, market })}`, NewsReportSchema, signal),
  telegram: async (body: TelegramMessage) => {
    const res = await fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(json?.error ?? `HTTP ${res.status}`, res.status);
  },
};

export type TelegramMessage =
  | { type: "test" }
  | { type: "ticket"; report: FinalReport }
  | { type: "invalidated"; report: FinalReport; previous: SignalStatus };

/** Start a workflow run and yield validated events as they stream in. */
export function streamAnalysis(req: AnalysisRequest, signal?: AbortSignal): AsyncGenerator<WorkflowEvent> {
  return streamNdjson("/api/analysis", req, WorkflowEventSchema, signal);
}

/** Start an Entry Radar scan and yield validated events as they stream in. */
export function streamScreener(req: ScreenRequest, signal?: AbortSignal): AsyncGenerator<ScreenEvent> {
  return streamNdjson("/api/screener", req, ScreenEventSchema, signal);
}

async function* streamNdjson<T>(url: string, body: unknown, schema: z.ZodType<T>, signal?: AbortSignal): AsyncGenerator<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err?.error ?? `HTTP ${res.status}`, res.status);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield schema.parse(JSON.parse(line));
    }
  }
}
