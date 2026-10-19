"use client";

import { create } from "zustand";
import type { AgentId } from "@/lib/domain/schemas";

/**
 * Camera intent for the 3D office, kept separate from three.js so 2D UI
 * (overlay buttons, pages) can steer the camera without loading WebGL code.
 */
interface CameraState {
  /** Desk to frame, or null for the overview shot. */
  focus: AgentId | null;
  /** Follow whichever agent is currently working. */
  followActive: boolean;
  /** Bumped to re-apply the same focus (e.g. after user dragged away). */
  nonce: number;
  focusOn: (id: AgentId | null) => void;
  setFollow: (v: boolean) => void;
}

export const useOfficeCamera = create<CameraState>((set) => ({
  focus: null,
  followActive: true,
  nonce: 0,
  focusOn: (focus) => set((s) => ({ focus, nonce: s.nonce + 1 })),
  setFollow: (followActive) => set({ followActive }),
}));
