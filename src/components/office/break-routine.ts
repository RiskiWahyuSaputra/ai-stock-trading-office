import { AGENT_ORDER } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { DESKS } from "./layout";

/**
 * Break-time routine in world coordinates (x, z). Pure geometry & timing so
 * it is deterministic: a page opened mid-break shows everyone where they
 * would be by now. Paths keep to aisles and walk around the lounge table on
 * an outer ring, so nobody walks through desks or colleagues.
 */

export type Vec2 = [number, number];

export const WALK_SPEED = 1.25;
export const LOUNGE_TABLE: Vec2 = [5.6, -3.6];
/** Where people stand around the table, and the outer ring they walk on. */
export const STAND_RING = 1.15;
export const WALK_RING = 1.65;
export const COUNTER_X = 7.55;
const POUR_X = 6.95;
const FRONT_AISLE_Z = 3.9;
const RIGHT_AISLE_X = 7.4;
const LOUNGE_ENTRY_Z = -1.9;
const SPOT_DEG = [70, 115, 160, 205, 250];
const POUR_Z = [-4.9, -4.3, -3.7, -3.1, -2.5];

export const STAND_UP_S = 0.9;
export const POUR_S = 3.2;
/** Hangout cycle: chat, then (from the second cycle on) a stroll to the window. */
export const CYCLE_S = 90;
/** Agents' strolls are this far apart, so only one is away at a time. */
const WANDER_GAP_S = 18;
const LOOK_S = 8;

export type Act = "stand_up" | "sit_down" | "pour" | "walk" | "hang" | "look" | "stretch" | "desk";

export interface Pose {
  x: number;
  z: number;
  /** Desired facing (rad, Y axis); the figure turns smoothly toward it. */
  yaw: number;
  act: Act;
  /** Seconds into the current act. */
  actT: number;
  /** Distance walked (m) — drives the stride. */
  stride: number;
  holdingMug: boolean;
}

const idx = (id: AgentId) => AGENT_ORDER.indexOf(id);
const rad = (d: number) => (d * Math.PI) / 180;
/** Yaw that turns a figure's −Z (its front) toward direction (dx, dz). */
export const yawToward = (dx: number, dz: number) => Math.atan2(-dx, -dz);

/** Desk-local point (0, 0, lz) in world space. */
function deskPoint(id: AgentId, lz: number): Vec2 {
  const { position, rotation } = DESKS[id];
  return [position[0] + Math.sin(rotation) * lz, position[2] + Math.cos(rotation) * lz];
}

export const chairSpot = (id: AgentId) => deskPoint(id, 0.62);
/** Seated characters face the desk (−Z in desk space). */
export const deskYaw = (id: AgentId) => DESKS[id].rotation;

const ring = (r: number, a: number): Vec2 => [LOUNGE_TABLE[0] + r * Math.cos(a), LOUNGE_TABLE[1] + r * Math.sin(a)];
const angleOf = ([x, z]: Vec2) => Math.atan2(z - LOUNGE_TABLE[1], x - LOUNGE_TABLE[0]);

/** Points along a ring arc from angle a to b (shortest way), every ~15°. */
function arc(r: number, a: number, b: number): Vec2[] {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(d) / rad(15)));
  return Array.from({ length: n + 1 }, (_, i) => ring(r, a + (d * i) / n));
}

export const spotOf = (id: AgentId) => ring(STAND_RING, rad(SPOT_DEG[idx(id)]));
const pourSlot = (id: AgentId): Vec2 => [POUR_X, POUR_Z[idx(id)]];
const viewPoint = (id: AgentId): Vec2 => [4.0 + idx(id) * 0.28, -5.35];

/** Desk → lounge entry, along the aisles. */
function exitPath(id: AgentId): Vec2[] {
  const chair = chairSpot(id);
  const back = deskPoint(id, 1.35);
  if (id === "officer") return [chair, back, [4.6, -0.8], [4.6, LOUNGE_ENTRY_Z]];
  return [chair, back, [back[0], FRONT_AISLE_Z], [RIGHT_AISLE_X, FRONT_AISLE_Z], [RIGHT_AISLE_X, LOUNGE_ENTRY_Z]];
}

/** From anywhere in the lounge, via the outer ring, to a stand spot or exit. */
function viaRing(from: Vec2, toAngle: number, end: Vec2): Vec2[] {
  const a = angleOf(from);
  return [from, ...arc(WALK_RING, a, toAngle), end];
}

export function pathToCounter(id: AgentId): Vec2[] {
  return [...exitPath(id), [POUR_X, LOUNGE_ENTRY_Z], pourSlot(id)];
}

export function pathToSpot(id: AgentId): Vec2[] {
  return viaRing(pourSlot(id), rad(SPOT_DEG[idx(id)]), spotOf(id));
}

export function pathToWindow(id: AgentId): Vec2[] {
  const view = viewPoint(id);
  return viaRing(spotOf(id), angleOf(view), view);
}

/** From the current position back to the chair. */
export function pathToDesk(id: AgentId, from: Vec2): Vec2[] {
  const exit = exitPath(id);
  const entry = exit[exit.length - 1];
  const inLounge = from[1] < LOUNGE_ENTRY_Z + 0.3 && from[0] > 3.5;
  const head = inLounge ? viaRing(from, angleOf(entry), entry) : [from, entry];
  return [...head, ...exit.slice(0, -1).reverse()];
}

export function pathLength(pts: Vec2[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** Position and heading `s` metres along a polyline. */
export function along(pts: Vec2[], s: number): { x: number; z: number; yaw: number } {
  let rest = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg === 0) continue;
    if (rest <= seg || i === pts.length - 1) {
      const k = Math.min(1, rest / seg);
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, yaw: yawToward(bx - ax, bz - az) };
    }
    rest -= seg;
  }
  const [x, z] = pts[pts.length - 1];
  return { x, z, yaw: 0 };
}

const walkS = (pts: Vec2[]) => pathLength(pts) / WALK_SPEED;

/** Where an agent is `t` seconds after leaving the desk for the break. */
export function breakPose(id: AgentId, t: number): Pose {
  const total = t;
  const toCounter = pathToCounter(id);
  const toSpot = pathToSpot(id);
  const [cx, cz] = chairSpot(id);
  const base = { holdingMug: false, stride: 0 };

  if (t < STAND_UP_S) return { ...base, x: cx, z: cz, yaw: deskYaw(id), act: "stand_up", actT: t };
  t -= STAND_UP_S;

  const w1 = walkS(toCounter);
  if (t < w1) return { ...base, ...along(toCounter, t * WALK_SPEED), act: "walk", actT: t, stride: t * WALK_SPEED };
  t -= w1;

  const [px, pz] = pourSlot(id);
  if (t < POUR_S) return { ...base, x: px, z: pz, yaw: yawToward(1, 0), act: "pour", actT: t, holdingMug: t > POUR_S * 0.6 };
  t -= POUR_S;

  const mug = { holdingMug: true, stride: 0 };
  const w2 = walkS(toSpot);
  if (t < w2) return { ...mug, ...along(toSpot, t * WALK_SPEED), act: "walk", actT: t, stride: t * WALK_SPEED };
  t -= w2;

  // Hangout. Each agent strolls to the window once per cycle, in turns
  // scheduled on the shared break clock, and only after reaching the table.
  const [sx, sz] = spotOf(id);
  const faceTable = yawToward(LOUNGE_TABLE[0] - sx, LOUNGE_TABLE[1] - sz);
  const arrived = total - t;
  const slot = CYCLE_S / 2 + idx(id) * WANDER_GAP_S;
  const k = Math.floor((total - slot) / CYCLE_S);
  const s = total - (k * CYCLE_S + slot);
  if (k >= 0 && k * CYCLE_S + slot >= arrived) {
    const out = pathToWindow(id);
    const w = walkS(out);
    if (s < w) return { ...mug, ...along(out, s * WALK_SPEED), act: "walk", actT: s, stride: s * WALK_SPEED };
    if (s < w + LOOK_S) {
      const [vx, vz] = out[out.length - 1];
      // Look out of the window, with a stretch halfway through.
      const lt = s - w;
      return { ...mug, x: vx, z: vz, yaw: yawToward(0, -1), act: lt > 3 && lt < 5.5 ? "stretch" : "look", actT: lt };
    }
    if (s < 2 * w + LOOK_S) {
      const back = [...out].reverse();
      const d = (s - w - LOOK_S) * WALK_SPEED;
      return { ...mug, ...along(back, d), act: "walk", actT: s, stride: d };
    }
  }
  return { ...mug, x: sx, z: sz, yaw: faceTable, act: "hang", actT: t };
}

/** Where an agent is `t` seconds after starting back from `from`; `act: "desk"` when seated again. */
export function returnPose(id: AgentId, from: Vec2, t: number): Pose {
  const path = pathToDesk(id, from);
  const w = walkS(path);
  if (t < w) return { ...along(path, t * WALK_SPEED), act: "walk", actT: t, stride: t * WALK_SPEED, holdingMug: true };
  const [cx, cz] = chairSpot(id);
  const st = t - w;
  return { x: cx, z: cz, yaw: deskYaw(id), act: st < STAND_UP_S ? "sit_down" : "desk", actT: st, stride: 0, holdingMug: false };
}
