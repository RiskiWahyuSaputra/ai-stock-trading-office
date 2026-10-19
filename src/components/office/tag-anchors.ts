import type { AgentId } from "@/lib/domain/schemas";
import { DESKS } from "./layout";

/**
 * Name tags are plain DOM elements positioned by projecting these world
 * anchors every frame (no extra React roots inside the canvas).
 */
export const tagElements = new Map<AgentId, HTMLElement>();

export function tagAnchor(id: AgentId): [number, number, number] {
  const { position, rotation } = DESKS[id];
  // Above the chair (local z = +0.62), rotated with the desk.
  const lz = 0.62;
  return [position[0] + Math.sin(rotation) * lz, 1.95, position[2] + Math.cos(rotation) * lz];
}
