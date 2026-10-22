import { z } from "zod";
import { FinalReportSchema, SignalStatusSchema } from "@/lib/domain/schemas";
import { invalidatedText, orderTicketText } from "@/lib/report/order-ticket";
import { errorResponse } from "@/server/http/respond";
import { kvConfigured, kvPipeline } from "@/server/kv";
import { sendTelegram, TelegramError } from "@/server/telegram";

const BodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("test") }),
  z.object({ type: z.literal("ticket"), report: FinalReportSchema }),
  z.object({ type: z.literal("invalidated"), report: FinalReportSchema, previous: SignalStatusSchema }),
]);

/** Messages per hour this endpoint may send (needs the Redis store to count). */
const HOURLY_LIMIT = 30;

/** Only the app's own pages may call this; a cross-site browser request is refused. */
function sameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

/**
 * POST /api/telegram — sends an order ticket (or a test / cancellation
 * message) to the configured Telegram chat. Notification only: no order is
 * ever placed with a broker.
 * Bounded so a public deployment cannot be used to flood the chat.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
  if (kvConfigured()) {
    const key = `telegram:rate:${Math.floor(Date.now() / 3_600_000)}`;
    const [count] = await kvPipeline([["INCR", key], ["EXPIRE", key, 3600]]);
    if (Number(count) > HOURLY_LIMIT) return Response.json({ error: `Batas ${HOURLY_LIMIT} pesan per jam tercapai.` }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body harus berupa JSON." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error);

  const b = parsed.data;
  const text =
    b.type === "test"
      ? "✅ AI Stock Trading Office terhubung. Order ticket BUY SETUP akan dikirim ke chat ini."
      : b.type === "ticket"
        ? orderTicketText(b.report)
        : invalidatedText(b.report, b.previous);
  try {
    await sendTelegram(text);
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof TelegramError) return Response.json({ error: err.message }, { status: 502 });
    return errorResponse(err);
  }
}
