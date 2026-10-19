import { connection } from "next/server";
import { z } from "zod";
import { CandleSeriesSchema, MarketSchema, TimeframeSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getMarketProvider } from "@/server/providers";

const Query = z.object({
  symbol: z.string().min(1).max(12),
  timeframe: TimeframeSchema.default("1D"),
  limit: z.coerce.number().int().min(10).max(400).default(120),
  market: MarketSchema.optional(),
});

/** GET /api/candles?symbol=BBCA&market=IDX&timeframe=1D&limit=120 */
export async function GET(request: Request) {
  await connection();
  try {
    const { symbol, timeframe, limit, market } = Query.parse(searchParams(request));
    const series = CandleSeriesSchema.parse(await getMarketProvider().getCandles(symbol, timeframe, limit, market));
    return Response.json(series);
  } catch (err) {
    return errorResponse(err);
  }
}
