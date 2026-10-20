import { z } from "zod";

/**
 * Domain schemas. Every payload that crosses the API boundary is validated
 * against these, so the UI never renders unchecked provider data.
 */

export const MarketSchema = z.enum(["IDX", "US"]);
export type Market = z.infer<typeof MarketSchema>;

export const TimeframeSchema = z.enum(["1h", "4h", "1D", "1W"]);
export type Timeframe = z.infer<typeof TimeframeSchema>;

/** Risk profile: changes minimum R/R and stop distance, never the data. */
export const AnalysisModeSchema = z.enum(["conservative", "balanced", "aggressive"]);
export type AnalysisMode = z.infer<typeof AnalysisModeSchema>;

export const DataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDemo: z.boolean(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;

export const StockInfoSchema = z.object({
  symbol: z.string().min(1).max(12),
  name: z.string(),
  market: MarketSchema,
  sector: z.string(),
  currency: z.enum(["IDR", "USD"]),
});
export type StockInfo = z.infer<typeof StockInfoSchema>;

export const CandleSchema = z
  .object({
    time: z.number().int().positive(),
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative(),
  })
  .refine((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close), {
    message: "Candle high/low inconsistent with open/close",
  });
export type Candle = z.infer<typeof CandleSchema>;

export const QuoteSchema = z.object({
  stock: StockInfoSchema,
  lastPrice: z.number().positive(),
  change: z.number(),
  changePct: z.number(),
  timestamp: z.number().int().positive(),
  source: DataSourceSchema,
  /** Whether the exchange is in its regular session (when the provider knows). */
  marketOpen: z.boolean().optional(),
  /** Exchange-imposed data delay in minutes (e.g. 10 for IDX on Yahoo). */
  delayMinutes: z.number().nonnegative().optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const CandleSeriesSchema = z.object({
  symbol: z.string(),
  timeframe: TimeframeSchema,
  candles: z.array(CandleSchema),
  source: DataSourceSchema,
  fetchedAt: z.number().int().positive(),
});
export type CandleSeries = z.infer<typeof CandleSeriesSchema>;

export const SentimentSchema = z.enum(["positive", "negative", "neutral"]);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const NewsItemSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  headline: z.string(),
  summary: z.string(),
  publisher: z.string(),
  url: z.string().url().optional(),
  publishedAt: z.number().int().positive(),
  eventAt: z.number().int().positive().optional(),
  source: DataSourceSchema,
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

/* ------------------------------------------------------------------ */
/* Agents & workflow                                                    */
/* ------------------------------------------------------------------ */

export const AgentIdSchema = z.enum(["news", "technical", "risk", "reviewer", "officer"]);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const AgentStatusSchema = z.enum([
  "idle",
  "queued",
  "researching",
  "analyzing",
  "risk_checking",
  "reviewing",
  "finalizing",
  "completed",
  "failed",
  "needs_attention",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const DirectionSchema = z.enum(["bullish", "bearish", "neutral"]);
export type Direction = z.infer<typeof DirectionSchema>;

export const PriceZoneSchema = z.object({ low: z.number().positive(), high: z.number().positive() });
export type PriceZone = z.infer<typeof PriceZoneSchema>;

export const NewsReportSchema = z.object({
  items: z.array(NewsItemSchema.extend({ sentiment: SentimentSchema, impact: z.enum(["low", "medium", "high"]) })),
  sentiment: SentimentSchema,
  sentimentScore: z.number().min(-1).max(1),
  summary: z.string(),
  catalysts: z.array(z.string()),
  risks: z.array(z.string()),
  method: z.string(),
  source: DataSourceSchema,
  completedAt: z.number(),
});
export type NewsReport = z.infer<typeof NewsReportSchema>;

export const IndicatorSnapshotSchema = z.object({
  sma20: z.number().nullable(),
  sma50: z.number().nullable(),
  ema200: z.number().nullable(),
  rsi14: z.number().nullable(),
  macd: z.number().nullable(),
  macdSignal: z.number().nullable(),
  macdHist: z.number().nullable(),
  atr14: z.number().nullable(),
  volumeRatio: z.number().nullable(),
});
export type IndicatorSnapshot = z.infer<typeof IndicatorSnapshotSchema>;

export const TechnicalReportSchema = z.object({
  direction: DirectionSchema,
  trendScore: z.number().min(-1).max(1),
  timeframe: TimeframeSchema,
  candlesUsed: z.number().int(),
  lastClose: z.number().positive(),
  indicators: IndicatorSnapshotSchema,
  supports: z.array(z.number()),
  resistances: z.array(z.number()),
  entryZone: PriceZoneSchema.nullable(),
  stopLoss: z.number().nullable(),
  takeProfits: z.array(z.number()),
  invalidationLevel: z.number().nullable(),
  reasons: z.array(z.string()),
  methods: z.array(z.string()),
  source: DataSourceSchema,
  dataTimestamp: z.number(),
  completedAt: z.number(),
});
export type TechnicalReport = z.infer<typeof TechnicalReportSchema>;

export const RiskStatusSchema = z.enum(["eligible", "caution", "rejected"]);
export type RiskStatus = z.infer<typeof RiskStatusSchema>;

export const RiskReportSchema = z.object({
  status: RiskStatusSchema,
  riskPerShare: z.number().nullable(),
  rewardPerShare: z.array(z.number()),
  riskReward: z.array(z.number()),
  minRiskReward: z.number(),
  volatilityPct: z.number().nullable(),
  maxGapPct: z.number().nullable(),
  position: z
    .object({
      accountSize: z.number(),
      riskPct: z.number(),
      maxLoss: z.number(),
      shares: z.number().int(),
      lots: z.number().int().nullable(),
      positionValue: z.number(),
    })
    .nullable(),
  issues: z.array(z.string()),
  notes: z.array(z.string()),
  completedAt: z.number(),
});
export type RiskReport = z.infer<typeof RiskReportSchema>;

export const ReviewVerdictSchema = z.enum([
  "approved",
  "needs_review",
  "conflicting",
  "insufficient_data",
]);
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;

export const ReviewReportSchema = z.object({
  verdict: ReviewVerdictSchema,
  checks: z.array(z.object({ label: z.string(), passed: z.boolean(), detail: z.string() })),
  conflicts: z.array(z.string()),
  returnedTo: z.array(AgentIdSchema),
  completedAt: z.number(),
});
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

export const SignalStatusSchema = z.enum(["BUY_SETUP", "SELL_SETUP", "WAIT", "NO_TRADE"]);
export type SignalStatus = z.infer<typeof SignalStatusSchema>;

export const AnalysisRequestSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .transform((s) => s.toUpperCase()),
  market: MarketSchema,
  timeframe: TimeframeSchema,
  mode: AnalysisModeSchema,
  accountSize: z.number().positive().optional(),
  riskPct: z.number().positive().max(10).optional(),
});
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;

export const ConfidenceSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.enum(["low", "moderate", "high"]),
  factors: z.array(z.object({ label: z.string(), impact: z.number() })),
  explanation: z.string(),
});
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const FinalReportSchema = z.object({
  id: z.string(),
  request: AnalysisRequestSchema,
  quote: QuoteSchema,
  status: SignalStatusSchema,
  direction: DirectionSchema,
  entryZone: PriceZoneSchema.nullable(),
  stopLoss: z.number().nullable(),
  takeProfits: z.array(z.number()),
  riskReward: z.array(z.number()),
  confidence: ConfidenceSchema,
  reasons: z.array(z.string()),
  mainRisks: z.array(z.string()),
  invalidation: z.array(z.string()),
  alternativeScenario: z.string(),
  news: NewsReportSchema,
  technical: TechnicalReportSchema,
  risk: RiskReportSchema,
  review: ReviewReportSchema,
  sources: z.array(DataSourceSchema),
  isDemo: z.boolean(),
  createdAt: z.number(),
  disclaimer: z.string(),
});
export type FinalReport = z.infer<typeof FinalReportSchema>;

/** Events streamed (NDJSON) from the workflow engine to the client. */
export const WorkflowEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run_started"),
    runId: z.string(),
    request: AnalysisRequestSchema,
    at: z.number(),
  }),
  z.object({
    type: z.literal("agent_status"),
    runId: z.string(),
    agent: AgentIdSchema,
    status: AgentStatusSchema,
    progress: z.number().min(0).max(100),
    message: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("run_completed"),
    runId: z.string(),
    report: FinalReportSchema,
    at: z.number(),
  }),
  z.object({
    type: z.literal("run_failed"),
    runId: z.string(),
    agent: AgentIdSchema.nullable(),
    error: z.string(),
    at: z.number(),
  }),
]);
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

/* ------------------------------------------------------------------ */
/* Entry Radar (screener)                                               */
/* ------------------------------------------------------------------ */

/** When a long entry can be taken: this session, the next one, later, or not at all. */
export const EntryTimingSchema = z.enum(["today", "next_session", "later", "avoid"]);
export type EntryTiming = z.infer<typeof EntryTimingSchema>;

export const EntryPlanSchema = z.object({
  timing: EntryTimingSchema,
  /** What the entry waits for. */
  trigger: z.enum(["in_zone", "pullback", "breakout", "confirmation", "none"]),
  /** Exchange-local trading day the plan targets (`YYYY-MM-DD`), null when open-ended. */
  day: z.string().nullable(),
  /** Rough trading-day estimate from distance ÷ ATR — not a forecast. */
  etaDays: z.tuple([z.number().int(), z.number().int()]).nullable(),
  triggerPrice: z.number().nullable(),
  headline: z.string(),
  reasons: z.array(z.string()),
});
export type EntryPlan = z.infer<typeof EntryPlanSchema>;

export const ScreenRequestSchema = z.object({
  market: MarketSchema,
  mode: AnalysisModeSchema,
  /** Explicit list (e.g. the watchlist); omitted → the provider's whole universe. */
  symbols: z
    .array(z.string().trim().min(1).max(12).transform((s) => s.toUpperCase()))
    .max(200)
    .optional(),
  accountSize: z.number().positive().optional(),
  riskPct: z.number().positive().max(10).optional(),
});
export type ScreenRequest = z.infer<typeof ScreenRequestSchema>;

export const ScreenItemSchema = z.object({
  stock: StockInfoSchema,
  lastPrice: z.number().positive(),
  changePct: z.number(),
  status: SignalStatusSchema,
  direction: DirectionSchema,
  trendScore: z.number(),
  confidence: z.number(),
  plan: EntryPlanSchema,
  /** Full report, kept only for candidates (not for `avoid`) to stay small. */
  report: FinalReportSchema.optional(),
});
export type ScreenItem = z.infer<typeof ScreenItemSchema>;

export const ScreenEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("scan_started"),
    scanId: z.string(),
    request: ScreenRequestSchema,
    total: z.number().int(),
    today: z.string(),
    nextDay: z.string(),
    sessionLabel: z.string(),
    at: z.number(),
  }),
  z.object({
    type: z.literal("scan_item"),
    scanId: z.string(),
    done: z.number().int(),
    total: z.number().int(),
    item: ScreenItemSchema,
    at: z.number(),
  }),
  z.object({
    type: z.literal("scan_error"),
    scanId: z.string(),
    done: z.number().int(),
    total: z.number().int(),
    symbol: z.string(),
    error: z.string(),
    at: z.number(),
  }),
  z.object({ type: z.literal("scan_completed"), scanId: z.string(), sources: z.array(DataSourceSchema), at: z.number() }),
  z.object({ type: z.literal("scan_failed"), scanId: z.string(), error: z.string(), at: z.number() }),
]);
export type ScreenEvent = z.infer<typeof ScreenEventSchema>;
