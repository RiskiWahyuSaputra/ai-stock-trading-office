import type { AgentId } from "@/lib/domain/schemas";

/** Desk placement in the office (world units ≈ meters). */
export interface DeskSpot {
  position: [number, number, number];
  rotation: number;
  /** Officer gets the large control desk. */
  variant: "standard" | "control";
}

export const DESKS: Record<AgentId, DeskSpot> = {
  news: { position: [-5, 0, 1.5], rotation: 0.5, variant: "standard" },
  technical: { position: [-1.6, 0, 2.4], rotation: 0.12, variant: "standard" },
  risk: { position: [1.6, 0, 2.4], rotation: -0.12, variant: "standard" },
  reviewer: { position: [5, 0, 1.5], rotation: -0.5, variant: "standard" },
  officer: { position: [0, 0, -2.2], rotation: 0, variant: "control" },
};

export const ROOM = { width: 16, depth: 12, height: 4.2 };

export const DEFAULT_VIEW = {
  position: [6.5, 7.2, 10] as [number, number, number],
  target: [0, 0.8, 0.2] as [number, number, number],
};

/** Camera framing for focusing one desk: behind-and-above the chair. */
export function focusView(id: AgentId) {
  const { position, rotation } = DESKS[id];
  const [x, , z] = position;
  const dist = id === "officer" ? 5.2 : 4.3;
  const side = 1.6;
  const cx = x + Math.sin(rotation) * dist + Math.cos(rotation) * side;
  const cz = z + Math.cos(rotation) * dist - Math.sin(rotation) * side;
  return {
    position: [cx, 3.4, cz] as [number, number, number],
    target: [x - Math.sin(rotation) * 0.4, 1.1, z - Math.cos(rotation) * 0.4] as [number, number, number],
  };
}
