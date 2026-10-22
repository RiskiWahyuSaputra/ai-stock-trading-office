import type { FinalReport, SignalStatus } from "@/lib/domain/schemas";
import { formatMoney, formatPrice, formatTime } from "@/lib/utils";

/**
 * Telegram messages (HTML parse mode) that turn a final report into an order
 * ticket the CEO enters by hand in their broker app. Nothing is executed:
 * the app only tells the human what to type and where the limits sit.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TZ = { IDX: "Asia/Jakarta", US: "America/New_York" } as const;

/** Split a position across TP1/TP2: half at TP1, the rest at TP2 (IDX lots stay whole). */
export function splitLots(lots: number) {
  const first = Math.ceil(lots / 2);
  return [first, lots - first] as const;
}

export function orderTicketText(r: FinalReport): string {
  const m = r.request.market;
  const p = (v: number | null | undefined) => formatPrice(v, m);
  const long = r.status === "BUY_SETUP";
  const pos = r.risk.position;
  const lots = pos?.lots ?? null;
  const qty = m === "IDX" ? (lots !== null ? `${lots} lot` : "—") : pos ? `${pos.shares} lembar` : "—";
  const lines: string[] = [];

  if (r.isDemo) lines.push("⚠️ <b>DEMO — data simulasi, JANGAN ditradingkan.</b>", "");
  lines.push(
    `${long ? "🟢" : "🔴"} <b>${esc(r.request.symbol)} — ${long ? "BUY SETUP" : "SELL SETUP"}</b> (${r.request.timeframe}, ${esc(r.request.mode)})`,
    `${esc(r.quote.stock.name)} · harga ${p(r.quote.lastPrice)} (${formatTime(r.quote.timestamp, TZ[m])})`,
    `Konfluensi ${r.confidence.score}/100 — bukan peluang profit`,
    "",
  );

  if (!r.entryZone || r.stopLoss === null) {
    lines.push("Tidak ada level entry yang diterbitkan.");
    return lines.join("\n");
  }

  if (long) {
    lines.push(
      "<b>Order beli (limit)</b>",
      `• Zona entry: <code>${p(r.entryZone.low)} – ${p(r.entryZone.high)}</code>`,
      `• Pasang limit di <code>${p(r.entryZone.high)}</code> atau lebih rendah, jumlah <b>${qty}</b>`,
      "",
      "<b>Setelah order match, pasang di fitur Stop Loss / Take Profit:</b>",
      `• Stop loss: <code>${p(r.stopLoss)}</code>`,
    );
    if (lots !== null && lots >= 2 && r.takeProfits.length >= 2) {
      const [a, b] = splitLots(lots);
      lines.push(
        `• TP1: <code>${p(r.takeProfits[0])}</code> untuk ${a} lot (R/R ${r.riskReward[0]?.toFixed(1) ?? "—"})`,
        `• TP2: <code>${p(r.takeProfits[1])}</code> untuk ${b} lot (R/R ${r.riskReward[1]?.toFixed(1) ?? "—"})`,
      );
    } else {
      lines.push(...r.takeProfits.slice(0, 2).map((tp, i) => `• TP${i + 1}: <code>${p(tp)}</code> (R/R ${r.riskReward[i]?.toFixed(1) ?? "—"})`));
    }
    if (pos) lines.push("", `Nilai posisi ±${formatMoney(pos.positionValue, m)} · rugi maks jika SL kena ±${formatMoney(pos.maxLoss, m)} (${pos.riskPct}% modal)`);
  } else {
    lines.push(
      m === "IDX" ? "<b>Short selling tidak tersedia untuk ritel IDX.</b> Hanya relevan bila Anda sudah memegang saham ini:" : "<b>Skenario turun:</b>",
      `• Pertimbangkan jual di zona <code>${p(r.entryZone.low)} – ${p(r.entryZone.high)}</code>`,
      `• Skenario batal jika harga di atas <code>${p(r.stopLoss)}</code>`,
    );
  }

  if (r.invalidation.length) lines.push("", "<b>Batalkan jika:</b>", ...r.invalidation.slice(0, 3).map((x) => `• ${esc(x)}`));
  lines.push(
    "",
    "⏱ Jangan kejar harga: bila sudah keluar dari zona entry, lewati atau jalankan analisis ulang.",
    `<i>${esc(r.disclaimer)}</i>`,
  );
  return lines.join("\n");
}

export function invalidatedText(r: FinalReport, previous: SignalStatus): string {
  const m = r.request.market;
  return [
    r.isDemo ? "⚠️ <b>DEMO</b>" : "",
    `⚪ <b>${esc(r.request.symbol)} — skenario ${previous.replace("_", " ")} batal</b>`,
    `Status terbaru ${r.status.replace("_", " ")} (${r.request.timeframe}), harga ${formatPrice(r.quote.lastPrice, m)}.`,
    "Batalkan order beli yang belum match. Bila sudah pegang, cek lagi stop loss Anda.",
  ]
    .filter(Boolean)
    .join("\n");
}
