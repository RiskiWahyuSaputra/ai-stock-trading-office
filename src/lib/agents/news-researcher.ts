import type { NewsItem, NewsReport, Sentiment } from "@/lib/domain/schemas";

/**
 * News Researcher — rule-based sentiment & catalyst extraction.
 * Deliberately transparent: keyword lexicon with recency weighting. An LLM
 * summariser can replace `classify` later without changing the report shape.
 */

const POSITIVE: [RegExp, number][] = [
  [/above (analyst )?consensus|beats? (estimates|expectations)/i, 1],
  [/record (revenue|profit|earnings)/i, 0.9],
  [/buyback/i, 0.7],
  [/higher (interim )?dividend|dividend (increase|hike)/i, 0.6],
  [/upgraded?/i, 0.6],
  [/partnership|contract win|acquires/i, 0.4],
  [/growth|expands?/i, 0.3],
];

const NEGATIVE: [RegExp, number][] = [
  [/falls? short|misses? (estimates|expectations)/i, -1],
  [/investigation|probe|fraud/i, -0.9],
  [/lawsuit|sued/i, -0.7],
  [/downgraded?/i, -0.6],
  [/weaker outlook|warns|profit warning/i, -0.7],
  [/rights issue|dilution/i, -0.4],
  [/rising costs|slowing demand/i, -0.3],
];

const HIGH_IMPACT = /earnings|profit|investigation|lawsuit|rights issue|dividend|buyback|downgrad|upgrad|outlook/i;
const MEDIUM_IMPACT = /partnership|index|rebalanc|general meeting|revenue/i;

export function classify(headline: string): { score: number; sentiment: Sentiment } {
  let score = 0;
  for (const [re, w] of [...POSITIVE, ...NEGATIVE]) if (re.test(headline)) score += w;
  score = Math.max(-1, Math.min(1, score));
  const sentiment: Sentiment = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
  return { score, sentiment };
}

export function impactOf(headline: string): "low" | "medium" | "high" {
  if (HIGH_IMPACT.test(headline)) return "high";
  if (MEDIUM_IMPACT.test(headline)) return "medium";
  return "low";
}

export function runNewsResearch(items: NewsItem[], source: NewsReport["source"], now = Date.now()): NewsReport {
  const enriched = items.map((it) => {
    const { score, sentiment } = classify(it.headline);
    return { ...it, sentiment, impact: impactOf(it.headline), _score: score };
  });

  // Recency weight: half-life of 24h. High-impact items count double.
  let num = 0;
  let den = 0;
  for (const it of enriched) {
    const ageH = Math.max(0, (now - it.publishedAt) / 3_600_000);
    const w = Math.pow(0.5, ageH / 24) * (it.impact === "high" ? 2 : 1);
    num += it._score * w;
    den += w;
  }
  const sentimentScore = den > 0 ? Math.round((num / den) * 100) / 100 : 0;
  const sentiment: Sentiment = sentimentScore > 0.15 ? "positive" : sentimentScore < -0.15 ? "negative" : "neutral";

  const catalysts = enriched.filter((i) => i.sentiment === "positive" && i.impact !== "low").map((i) => i.headline);
  const risks = enriched
    .filter((i) => i.sentiment === "negative" || (i.impact === "high" && i.sentiment === "neutral"))
    .map((i) => i.headline);

  const pos = enriched.filter((i) => i.sentiment === "positive").length;
  const neg = enriched.filter((i) => i.sentiment === "negative").length;
  const summary =
    enriched.length === 0
      ? "Tidak ada berita yang ditemukan dari sumber data untuk periode ini."
      : `${enriched.length} berita ditinjau: ${pos} positif, ${neg} negatif, ${enriched.length - pos - neg} netral. ` +
        `Skor sentimen tertimbang ${sentimentScore >= 0 ? "+" : ""}${sentimentScore.toFixed(2)} (${sentiment}).`;

  return {
    items: enriched.map(({ _score: _ignored, ...rest }) => rest),
    sentiment,
    sentimentScore,
    summary,
    catalysts,
    risks,
    method: "Rule-based keyword lexicon, recency-weighted (half-life 24h), high-impact ×2. Bukan LLM.",
    source,
    completedAt: now,
  };
}
