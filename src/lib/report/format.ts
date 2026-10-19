import { AGENTS } from "@/lib/domain/agents";
import type { FinalReport } from "@/lib/domain/schemas";
import { formatPrice } from "@/lib/utils";

/** Plain-text/Markdown rendering of a final report for copy & export. */
export function reportToMarkdown(r: FinalReport) {
  const m = r.request.market;
  const p = (v: number | null | undefined) => formatPrice(v, m);
  const demo = r.isDemo ? " [DEMO — data simulasi, bukan data pasar nyata]" : "";
  const lines = [
    `# ${r.request.symbol} — ${r.quote.stock.name}${demo}`,
    "",
    `**Analysis Status:** ${r.status.replace("_", " ")}  `,
    `**Arah teknikal:** ${r.direction} · **Konfluensi:** ${r.confidence.score}/100 (${r.confidence.label})`,
    "",
    "## Market Data",
    `- Last price: ${p(r.quote.lastPrice)} ${r.quote.stock.currency} (${new Date(r.quote.timestamp).toISOString()})`,
    `- Timeframe: ${r.request.timeframe} · Mode: ${r.request.mode}`,
    `- Sumber: ${r.sources.map((s) => s.name).join(", ")}`,
    "",
    "## Trade Scenario",
  ];
  if (r.entryZone) {
    lines.push(
      `- Entry zone: ${p(r.entryZone.low)} – ${p(r.entryZone.high)}`,
      `- Stop loss: ${p(r.stopLoss)}`,
      ...r.takeProfits.map((tp, i) => `- TP${i + 1}: ${p(tp)} (R/R ${r.riskReward[i]?.toFixed(2) ?? "—"})`),
    );
  } else {
    lines.push("- Tidak ada level entry yang diterbitkan untuk status ini.");
  }
  lines.push(
    "",
    "## Why This Setup?",
    ...r.reasons.map((x) => `- ${x}`),
    "",
    "## Risiko Utama",
    ...r.mainRisks.map((x) => `- ${x}`),
    "",
    "## Invalidation Conditions",
    ...r.invalidation.map((x) => `- ${x}`),
    `- Skenario alternatif: ${r.alternativeScenario}`,
    "",
    "## Team Review",
    `- ${AGENTS.news.title}: sentimen ${r.news.sentiment} (${r.news.sentimentScore.toFixed(2)})`,
    `- ${AGENTS.technical.title}: tren ${r.technical.direction} (${r.technical.trendScore.toFixed(2)})`,
    `- ${AGENTS.risk.title}: ${r.risk.status}`,
    `- ${AGENTS.reviewer.title}: ${r.review.verdict}`,
    "",
    `Confidence: ${r.confidence.explanation}`,
    "",
    `_Dibuat ${new Date(r.createdAt).toISOString()} · ID ${r.id}_`,
    "",
    `> ${r.disclaimer}`,
  );
  return lines.join("\n");
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
