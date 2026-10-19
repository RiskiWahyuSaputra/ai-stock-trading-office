import { z } from "zod";
import { MarketSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getMarketProvider } from "@/server/providers";

const Query = z.object({ q: z.string().max(40).default(""), market: MarketSchema.optional() });

/** GET /api/symbols?q=bb&market=IDX — autocomplete from the active provider. */
export async function GET(request: Request) {
  try {
    const { q, market } = Query.parse(searchParams(request));
    const provider = getMarketProvider();
    const results = await provider.searchSymbols(q, market);
    return Response.json({ results, source: provider.source });
  } catch (err) {
    return errorResponse(err);
  }
}
