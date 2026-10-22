import "server-only";

/**
 * Minimal Upstash Redis client over its REST API (no SDK). Accepts the
 * variable names of both the Upstash and the Vercel Marketplace integration.
 */
const url = () => (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim().replace(/\/$/, "") || null;
const token = () => (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim() || null;

export function kvConfigured() {
  return url() !== null && token() !== null;
}

export type KvCommand = (string | number)[];

/** Run several commands in one round trip; returns each command's result. */
export async function kvPipeline(commands: KvCommand[]): Promise<unknown[]> {
  const u = url();
  const t = token();
  if (!u || !t) throw new Error("Penyimpanan belum dikonfigurasi: isi UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN.");
  if (commands.length === 0) return [];
  const res = await fetch(`${u}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands.map((c) => c.map(String))),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Upstash Redis HTTP ${res.status}`);
  const rows = (await res.json()) as { result?: unknown; error?: string }[];
  const failed = rows.find((r) => r.error);
  if (failed) throw new Error(`Upstash Redis: ${failed.error}`);
  return rows.map((r) => r.result);
}

export async function kv(...command: KvCommand): Promise<unknown> {
  return (await kvPipeline([command]))[0];
}
