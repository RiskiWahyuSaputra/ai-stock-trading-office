import { describe, expect, it } from "vitest";
import { AGENT_ORDER } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import {
  along,
  breakPose,
  chairSpot,
  LOUNGE_TABLE,
  pathLength,
  pathToCounter,
  pathToDesk,
  pathToSpot,
  pathToWindow,
  returnPose,
  spotOf,
  type Vec2,
} from "./break-routine";
import { DESKS, ROOM } from "./layout";
import { PLANTS } from "./OfficeScene";

/** Desk footprint (desk + chair) in its own frame, padded by a body radius. */
function insideDesk(id: AgentId, [x, z]: Vec2, pad = 0.2) {
  const { position, rotation, variant } = DESKS[id];
  const dx = x - position[0];
  const dz = z - position[2];
  const lx = dx * Math.cos(rotation) - dz * Math.sin(rotation);
  const lz = dx * Math.sin(rotation) + dz * Math.cos(rotation);
  const half = (variant === "control" ? 2.6 : 1.6) / 2;
  return Math.abs(lx) < half + pad && lz > -0.62 - pad && lz < 0.87 + pad;
}

function samples(pts: Vec2[]): Vec2[] {
  const len = pathLength(pts);
  return Array.from({ length: Math.ceil(len / 0.05) + 1 }, (_, i) => {
    const p = along(pts, i * 0.05);
    return [p.x, p.z] as Vec2;
  });
}

function obstacles(owner: AgentId, p: Vec2) {
  const hits: string[] = [];
  for (const id of AGENT_ORDER) if (id !== owner && insideDesk(id, p)) hits.push(`desk ${id}`);
  if (Math.hypot(p[0] - LOUNGE_TABLE[0], p[1] - LOUNGE_TABLE[1]) < 0.95) hits.push("lounge table");
  for (const gx of [-3.2, 3.2]) if (Math.abs(p[0] - gx) < 0.85 && Math.abs(p[1] + 1.1) < 0.15) hits.push("glass partition");
  if (Math.abs(p[0]) > ROOM.width / 2 - 0.2 || Math.abs(p[1]) > ROOM.depth / 2 - 0.2) hits.push("wall");
  if (p[0] > 7.25 && p[1] < -2.1 && p[1] > -5.3) hits.push("coffee counter");
  for (const [x, z] of PLANTS) if (Math.hypot(p[0] - x, p[1] - z) < 0.7) hits.push("plant");
  return hits;
}

describe("break routine", () => {
  for (const id of AGENT_ORDER) {
    it(`${id}: every path stays in the aisles`, () => {
      const paths = { toCounter: pathToCounter(id), toSpot: pathToSpot(id), toWindow: pathToWindow(id), home: pathToDesk(id, spotOf(id)) };
      for (const [name, pts] of Object.entries(paths)) {
        // Leaving/arriving at one's own chair is allowed to touch one's own desk only.
        const bad = samples(pts).flatMap((p) => obstacles(id, p).map((h) => `${name} @ ${p.map((v) => v.toFixed(2))}: ${h}`));
        expect(bad.slice(0, 3)).toEqual([]);
      }
    });
  }

  it("is deterministic and ends back in the chair", () => {
    const a = breakPose("news", 30);
    expect(breakPose("news", 30)).toEqual(a);
    const home = returnPose("news", [a.x, a.z], 200);
    expect(home.act).toBe("desk");
    expect([home.x, home.z]).toEqual(chairSpot("news"));
  });

  it("gets everyone a coffee and to the table within a couple of minutes", () => {
    for (const id of AGENT_ORDER) {
      const p = breakPose(id, 60);
      expect(p.holdingMug).toBe(true);
      expect(["hang", "walk"]).toContain(p.act);
    }
  });

  it("sends people to the window only from the second cycle, one at a time", () => {
    for (let t = 0; t < 400; t += 1) {
      const away = AGENT_ORDER.filter((id) => ["look", "stretch"].includes(breakPose(id, t).act));
      expect(away.length).toBeLessThanOrEqual(1);
    }
  });
});
