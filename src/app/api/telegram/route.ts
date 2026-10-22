import { z } from "zod";
import { FinalReportSchema, SignalStatusSchema } from "@/lib/domain/schemas";
import { invalidatedText, orderTicketText } from "@/lib/report/order-ticket";
import { errorResponse } from "@/server/http/respond";
import { sendTelegram, TelegramError } from "@/server/telegram";

const BodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("test") }),
  z.object({ type: z.literal("ticket"), report: FinalReportSchema }),
  z.object({ type: z.literal("invalidated"), report: FinalReportSchema, previous: SignalStatusSchema }),
]);

/**
 * POST /api/telegram — sends an order ticket (or a test / cancellation
 * message) to the configured Telegram chat. Notification only: no order is
 * ever placed with a broker.
 */
export async function POST(request: Request) {
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
