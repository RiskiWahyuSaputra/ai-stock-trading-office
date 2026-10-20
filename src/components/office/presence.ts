import type * as THREE from "three";
import type { AgentId } from "@/lib/domain/schemas";

/**
 * Per-frame presence shared between the 3D components without React
 * re-renders: who is away from their desk, and where their name tag should
 * float while they walk around.
 */
export const awayFromDesk = new Set<AgentId>();
export const liveTagAnchors = new Map<AgentId, THREE.Vector3>();
