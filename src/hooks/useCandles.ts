"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { CandleSeries, Timeframe } from "@/lib/domain/schemas";

/** Fetch a candle series for charts; refetches when symbol/timeframe change. */
export function useCandles(symbol: string | null, timeframe: Timeframe, limit = 120) {
  const [state, setState] = useState<{ key: string; data: CandleSeries | null; error: string | null }>({ key: "", data: null, error: null });
  const key = symbol ? `${symbol}|${timeframe}|${limit}` : "";

  useEffect(() => {
    if (!symbol) return;
    const ctrl = new AbortController();
    api
      .candles(symbol, timeframe, limit, ctrl.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setState({ key, data: null, error: e.message });
      });
    return () => ctrl.abort();
  }, [symbol, timeframe, limit, key]);

  const fresh = state.key === key;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, loading: !!symbol && !fresh };
}
