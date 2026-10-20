import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.MARKET_DATA_PROVIDER = "demo";
process.env.NEWS_PROVIDER = "demo";

const { runAnalysisWorkflow } = await import("./engine");

describe("analysis workflow", () => {
  it("hands each finished output to the next agent before the report", async () => {
    const events = [];
    for await (const e of runAnalysisWorkflow({ symbol: "BBCA", market: "IDX", timeframe: "1D", mode: "balanced" })) events.push(e);
    const handoffs = events.filter((e) => e.type === "handoff").map((e) => `${e.from}>${e.to}`);
    expect(handoffs.slice(0, 3)).toEqual(["news>reviewer", "technical>risk", "risk>reviewer"]);
    expect(handoffs.at(-1)).toBe("reviewer>officer");
    expect(events.at(-1)?.type).toBe("run_completed");
  }, 20_000);
});
