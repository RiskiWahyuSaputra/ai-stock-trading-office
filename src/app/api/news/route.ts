import { connection } from "next/server";
import { z } from "zod";
import { runNewsResearch } from "@/lib/agents/news-researcher";
import { MarketSchema, NewsItemSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getNewsProvider } from "@/server/providers";

const Query = z.object({
  symbol: z.string().min(1).max(12),
  limit: z.coerce.number().int().min(1).max(20).default(8),
  market: MarketSchema.optional(),
});

/** GET /api/news?symbol=BBCA&market=IDX — news with rule-based sentiment classification. */
export async function GET(request: Request) {
  await connection();
  try {
    const { symbol, limit, market } = Query.parse(searchParams(request));
    const provider = getNewsProvider();
    const items = z.array(NewsItemSchema).parse(await provider.getNews(symbol, limit, market));
    return Response.json(runNewsResearch(items, provider.source));
  } catch (err) {
    return errorResponse(err);
  }
}
