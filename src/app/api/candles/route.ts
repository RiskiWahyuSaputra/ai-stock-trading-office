import { z } from "zod";
import { CandleSeriesSchema, TimeframeSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getMarketProvider } from "@/server/providers";

const Query = z.object({
  symbol: z.string().min(1).max(12),
  timeframe: TimeframeSchema.default("1D"),
  limit: z.coerce.number().int().min(10).max(400).default(120),
});

/** GET /api/candles?symbol=BBCA&timeframe=1D&limit=120 */
export async function GET(request: Request) {
  try {
    const { symbol, timeframe, limit } = Query.parse(searchParams(request));
    const series = CandleSeriesSchema.parse(await getMarketProvider().getCandles(symbol, timeframe, limit));
    return Response.json(series);
  } catch (err) {
    return errorResponse(err);
  }
}
