import { z } from "zod";
import { runNewsResearch } from "@/lib/agents/news-researcher";
import { NewsItemSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getNewsProvider } from "@/server/providers";

const Query = z.object({
  symbol: z.string().min(1).max(12),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

/** GET /api/news?symbol=BBCA — news with rule-based sentiment classification. */
export async function GET(request: Request) {
  try {
    const { symbol, limit } = Query.parse(searchParams(request));
    const provider = getNewsProvider();
    const items = z.array(NewsItemSchema).parse(await provider.getNews(symbol, limit));
    return Response.json(runNewsResearch(items, provider.source));
  } catch (err) {
    return errorResponse(err);
  }
}
