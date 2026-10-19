import { AnalysisRequestSchema } from "@/lib/domain/schemas";
import { errorResponse } from "@/server/http/respond";
import { runAnalysisWorkflow } from "@/server/workflow/engine";

/**
 * POST /api/analysis — runs the agent workflow and streams each event as one
 * line of JSON (NDJSON) so the office can follow real progress.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }
  const parsed = AnalysisRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runAnalysisWorkflow(parsed.data)) {
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
