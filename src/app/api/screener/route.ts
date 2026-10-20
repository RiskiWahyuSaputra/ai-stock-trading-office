import { ScreenRequestSchema } from "@/lib/domain/schemas";
import { errorResponse } from "@/server/http/respond";
import { runScreener } from "@/server/workflow/screener";

/**
 * POST /api/screener — Entry Radar. Scans a universe and streams one NDJSON
 * line per screened symbol so the page can show real progress.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }
  const parsed = ScreenRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runScreener(parsed.data)) {
          if (request.signal.aborted) break;
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
