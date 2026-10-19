import { z } from "zod";
import { QuoteSchema } from "@/lib/domain/schemas";
import { errorResponse, searchParams } from "@/server/http/respond";
import { getMarketProvider } from "@/server/providers";

const Query = z.object({ symbol: z.string().min(1).max(12) });

/** GET /api/quote?symbol=BBCA */
export async function GET(request: Request) {
  try {
    const { symbol } = Query.parse(searchParams(request));
    const quote = QuoteSchema.parse(await getMarketProvider().getQuote(symbol));
    return Response.json(quote);
  } catch (err) {
    return errorResponse(err);
  }
}
