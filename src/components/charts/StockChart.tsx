"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sma } from "@/lib/analysis/indicators";
import type { Candle, Market, PriceZone, Timeframe } from "@/lib/domain/schemas";
import { formatPrice } from "@/lib/utils";

export interface ChartLevels {
  entryZone: PriceZone | null;
  stopLoss: number | null;
  takeProfits: number[];
}

interface Row extends Candle {
  range: [number, number];
  sma20: number | null;
  up: boolean;
}

const AXIS = { fill: "var(--fg-subtle)", fontSize: 11 };

function fmtTime(t: number, tf: Timeframe) {
  const d = new Date(t);
  return tf === "1h" || tf === "4h"
    ? d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: tf === "1W" ? "2-digit" : undefined });
}

/** Candle drawn inside the [low, high] bar box that Recharts gives us. */
function CandleShape(props: { x?: number; y?: number; width?: number; height?: number; payload?: Row }) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload) return null;
  const { open, close, high, low, up } = payload;
  const span = high - low || 1;
  const py = (p: number) => y + ((high - p) / span) * height;
  const color = up ? "var(--bull)" : "var(--bear)";
  const bodyTop = py(Math.max(open, close));
  const bodyH = Math.max(1, Math.abs(py(open) - py(close)));
  const cx = x + width / 2;
  const bw = Math.max(1, width * 0.7);
  return (
    <g>
      <line x1={cx} x2={cx} y1={y} y2={y + height} stroke={color} strokeWidth={1} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} rx={Math.min(1.5, bw / 3)} />
    </g>
  );
}

function PriceTooltip({ active, payload, market, tf }: { active?: boolean; payload?: { payload: Row }[]; market: Market; tf: Timeframe }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const items: [string, number | null][] = [
    ["Open", row.open],
    ["High", row.high],
    ["Low", row.low],
    ["Close", row.close],
    ["SMA20", row.sma20],
  ];
  return (
    <div className="rounded-lg border border-line-strong bg-bg-elevated px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-fg">{fmtTime(row.time, tf)}</div>
      <dl className="tabular grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
        {items.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-subtle">{k}</dt>
            <dd className="text-right text-fg">{formatPrice(v, market)}</dd>
          </div>
        ))}
        <dt className="text-subtle">Volume</dt>
        <dd className="text-right text-fg">{row.volume.toLocaleString("id-ID")}</dd>
      </dl>
    </div>
  );
}

/**
 * Candlestick price chart with SMA20 and the scenario levels, plus a separate
 * volume chart underneath (one y-axis per chart — never dual axes).
 */
export function StockChart({
  candles,
  market,
  timeframe,
  levels,
  height = 320,
}: {
  candles: Candle[];
  market: Market;
  timeframe: Timeframe;
  levels?: ChartLevels | null;
  height?: number;
}) {
  const rows: Row[] = useMemo(() => {
    const ma = sma(
      candles.map((c) => c.close),
      20,
    );
    return candles.map((c, i) => ({ ...c, range: [c.low, c.high], sma20: ma[i], up: c.close >= c.open }));
  }, [candles]);

  const domain = useMemo(() => {
    const prices = candles.flatMap((c) => [c.low, c.high]);
    if (levels?.stopLoss) prices.push(levels.stopLoss);
    // Every published level stays visible: never hide a target or stop off-chart.
    if (levels) prices.push(...levels.takeProfits);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const pad = (hi - lo) * 0.06;
    return [lo - pad, hi + pad] as [number, number];
  }, [candles, levels]);

  if (candles.length === 0) return null;

  return (
    <div className="w-full">
      <div style={{ height }} role="img" aria-label={`Grafik candlestick ${candles.length} bar ${timeframe}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 64, bottom: 0, left: 0 }} barCategoryGap={1}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="time" tickFormatter={(t) => fmtTime(t, timeframe)} tick={AXIS} axisLine={false} tickLine={false} minTickGap={48} />
            <YAxis
              domain={domain}
              orientation="right"
              tickFormatter={(v) => formatPrice(v, market)}
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              width={60}
              allowDataOverflow
            />
            <Tooltip content={<PriceTooltip market={market} tf={timeframe} />} cursor={{ stroke: "var(--fg-subtle)", strokeDasharray: "3 3" }} isAnimationActive={false} />
            {levels?.entryZone && (
              <ReferenceArea y1={levels.entryZone.low} y2={levels.entryZone.high} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeOpacity={0.4} ifOverflow="extendDomain" />
            )}
            <Bar dataKey="range" shape={<CandleShape />} isAnimationActive={false} />
            <Line dataKey="sma20" stroke="var(--info)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            {levels?.stopLoss != null && (
              <ReferenceLine y={levels.stopLoss} stroke="var(--bear)" strokeDasharray="4 4" label={{ value: `SL ${formatPrice(levels.stopLoss, market)}`, position: "right", fill: "var(--fg-muted)", fontSize: 10 }} />
            )}
            {levels?.takeProfits.map((tp, i) => (
              <ReferenceLine key={i} y={tp} stroke="var(--bull)" strokeDasharray="4 4" strokeOpacity={0.8} label={{ value: `TP${i + 1}`, position: "right", fill: "var(--fg-muted)", fontSize: 10 }} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-16" aria-label="Volume">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 64, bottom: 0, left: 0 }} barCategoryGap={1}>
            <XAxis dataKey="time" hide />
            <YAxis orientation="right" tick={false} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<PriceTooltip market={market} tf={timeframe} />} cursor={{ fill: "var(--panel-2)" }} isAnimationActive={false} />
            <Bar dataKey="volume" fill="var(--fg-subtle)" fillOpacity={0.55} isAnimationActive={false} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-info" />SMA20</span>
        {levels?.entryZone && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-accent/30 ring-1 ring-accent/50" />Entry zone</span>}
        {levels?.stopLoss != null && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-bear" />Stop loss</span>}
        {!!levels?.takeProfits.length && <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-bull" />Take profit</span>}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2 rounded-sm bg-subtle/60" />Volume</span>
      </div>
    </div>
  );
}
