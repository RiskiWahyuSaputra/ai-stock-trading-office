import { describe, expect, it, vi } from "vitest";
import type { Market, SignalStatus } from "@/lib/domain/schemas";

vi.mock("server-only", () => ({}));
// Demo providers without their artificial latency, so a whole-universe scan runs in milliseconds.
vi.mock("@/server/providers", async (original) => {
  const { DemoMarketProvider } = await import("@/server/providers/demo-market");
  const { DemoNewsProvider } = await import("@/server/providers/demo-news");
  const market = new DemoMarketProvider([0, 0]);
  const news = new DemoNewsProvider([0, 0]);
  return { ...(await original<object>()), getMarketProvider: () => market, getNewsProvider: () => news };
});

const { runSignalScan, signalConfigFromEnv } = await import("./signal-scan");

const memoryStore = (initial: Record<string, SignalStatus> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    load: async () => new Map(data),
    save: async (_market: Market, changes: Map<string, SignalStatus>) => changes.forEach((v, k) => data.set(k, v)),
  };
};

const cfg = { ...signalConfigFromEnv({}), watchlist: ["BBCA"] };

describe("signalConfigFromEnv", () => {
  it("falls back to safe defaults", () => {
    expect(signalConfigFromEnv({ SIGNAL_RISK_PCT: "50", SIGNAL_MODE: "yolo", SIGNAL_WATCHLIST: " bumi, bbca ," })).toMatchObject({
      market: "IDX",
      mode: "balanced",
      riskPct: 10,
      watchlist: ["BUMI", "BBCA"],
    });
  });
});

describe("runSignalScan", () => {
  it("announces each setup once across scans", async () => {
    const store = memoryStore();
    const send = vi.fn(async () => {});
    const first = await runSignalScan(cfg, store, send);
    expect(first.analysed).toContain("BBCA");
    expect(send).toHaveBeenCalledTimes(first.sent.length);
    for (const s of first.sent) expect(store.data.get(s.symbol)).toBe(s.status);

    send.mockClear();
    const second = await runSignalScan(cfg, store, send);
    const repeated = second.sent.filter((s) => s.type === "ticket" && first.sent.some((f) => f.symbol === s.symbol && f.status === s.status));
    expect(repeated).toEqual([]);
  });

  it("re-checks open setups and keeps them pending when Telegram fails", async () => {
    const store = memoryStore({ ZZZZ: "BUY_SETUP" });
    const send = vi.fn(async () => {
      throw new Error("offline");
    });
    const res = await runSignalScan(cfg, store, send);
    expect(res.analysed).toContain("ZZZZ");
    expect(res.errors.some((e) => e.symbol === "ZZZZ")).toBe(true);
    expect(store.data.get("ZZZZ")).toBe("BUY_SETUP");
  });
});
