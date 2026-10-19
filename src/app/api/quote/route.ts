import { connection } from "next/server";
import { z } from "zod";
import { MarketSchema, QuoteSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getMarketProvider } from "@/server/providers";

const Query = z.object({ symbol: z.string().min(1).max(12), market: MarketSchema.optional() });

/** GET /api/quote?symbol=BBCA&market=IDX */
export async function GET(request: Request) {
  await connection();
  try {
    const { symbol, market } = Query.parse(searchParams(request));
    const quote = QuoteSchema.parse(await getMarketProvider().getQuote(symbol, market));
    return Response.json(quote);
  } catch (err) {
    return errorResponse(err);
  }
}
