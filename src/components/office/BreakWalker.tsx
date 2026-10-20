"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { AGENTS } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { breakPose, returnPose, STAND_UP_S, type Pose, type Vec2 } from "./break-routine";
import { Upper } from "./EmployeeCharacter";
import type { Mood } from "./Face";
import { awayFromDesk, liveTagAnchors } from "./presence";

const PANTS = "#1e2638";
const SHOE = "#0d111a";
const HIP_Y = 0.95;
const STRIDE_M = 1.1;

type Mode = { kind: "desk" } | { kind: "break"; leftAt: number } | { kind: "return"; from: Vec2; at: number };

const ease = (v: number, target: number, k: number) => v + (target - v) * k;
const angleEase = (v: number, target: number, k: number) => {
  let d = target - v;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return v + d * k;
};

interface Joints {
  hip: number;
  torso: number;
  thighL: number;
  thighR: number;
  shinL: number;
  shinR: number;
  upL: number;
  upR: number;
  foreL: number;
  foreR: number;
  sideL: number;
  sideR: number;
  yaw: number;
  pitch: number;
}

/** Target joint angles for a routine pose (arms rotate forward with +x, like the seated rig). */
function jointsFor(p: Pose, t: number, seed: number): Joints {
  const j: Joints = { hip: HIP_Y, torso: 0.03, thighL: 0, thighR: 0, shinL: 0, shinR: 0, upL: 0.12, upR: 0.12, foreL: 0.25, foreR: 0.25, sideL: 0.08, sideR: -0.08, yaw: 0, pitch: 0 };
  const mug = () => {
    j.upR = 0.35;
    j.foreR = 1.35;
  };

  switch (p.act) {
    case "stand_up":
    case "sit_down": {
      // Seated (k = 0) ↔ standing (k = 1).
      const k = Math.min(1, p.actT / STAND_UP_S);
      const s = p.act === "stand_up" ? k : 1 - k;
      j.hip = 0.6 + 0.35 * s;
      j.thighL = j.thighR = 1.45 * (1 - s);
      j.shinL = j.shinR = -1.45 * (1 - s);
      j.torso = 0.35 * (1 - s) * Math.sin(Math.PI * s) + 0.03;
      break;
    }
    case "walk": {
      const w = (p.stride / STRIDE_M) * Math.PI * 2;
      j.thighL = Math.sin(w) * 0.5;
      j.thighR = -Math.sin(w) * 0.5;
      j.shinL = -Math.max(0, -Math.sin(w)) * 0.7;
      j.shinR = -Math.max(0, Math.sin(w)) * 0.7;
      j.upL = 0.12 - Math.sin(w) * 0.4;
      j.upR = 0.12 + Math.sin(w) * 0.4;
      j.hip = HIP_Y + Math.abs(Math.cos(w)) * 0.03;
      j.torso = 0.06;
      if (p.holdingMug) mug();
      break;
    }
    case "pour":
      j.upL = j.upR = 0.95 + Math.sin(t * 3) * 0.05;
      j.foreL = j.foreR = 0.5;
      j.pitch = 0.25;
      break;
    case "hang": {
      mug();
      // Sip every ~9 s; otherwise chat with gestures and look at colleagues.
      const sip = (t + seed * 3) % 9;
      if (sip > 7.4) {
        j.upR = 0.95;
        j.foreR = 2.35;
        j.pitch = -0.22;
      } else {
        j.upL = 0.55 + Math.max(0, Math.sin(t * 1.3 + seed)) * 0.35;
        j.foreL = 1.15 + Math.sin(t * 2.6 + seed) * 0.2;
        j.sideL = 0.15 + Math.sin(t * 1.9) * 0.1;
        j.yaw = Math.sin(t * 0.45 + seed) * 0.6;
        j.pitch = Math.sin(t * 0.8) * 0.08;
        // A laugh now and then.
        if (Math.sin(t * 0.37 + seed) > 0.93) j.torso = -0.12 + Math.sin(t * 18) * 0.04;
      }
      j.hip = HIP_Y + Math.sin(t * 1.4 + seed) * 0.006;
      break;
    }
    case "look":
      mug();
      j.upL = -0.3;
      j.foreL = 0.8;
      j.yaw = Math.sin(t * 0.5) * 0.45;
      j.pitch = -0.08;
      break;
    case "stretch":
      j.upL = j.upR = 3.0;
      j.foreL = j.foreR = 0.15;
      j.sideL = -0.25;
      j.sideR = 0.25;
      j.torso = -0.15;
      j.pitch = -0.3;
      break;
    case "desk":
      break;
  }
  return j;
}

/**
 * The standing version of an employee during the prayer-time break. It takes
 * over from the seated character (which hides) when leaving the desk and
 * hands back when seated again. Everything is driven by `prayerBreak` in the
 * store and the deterministic routine — no random wandering.
 */
export function BreakWalker({ id }: { id: AgentId }) {
  const profile = AGENTS[id];
  const prayerBreak = useOffice((s) => s.prayerBreak);
  const busy = useOffice((s) => s.run?.phase === "running");
  const seed = useMemo(() => profile.id.length * 1.7 + profile.name.length, [profile]);

  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const thighL = useRef<THREE.Group>(null);
  const thighR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const mug = useRef<THREE.Group>(null);
  const mood = useRef<Mood>({ smile: 0.5, brows: 0.2, talking: false });
  const mode = useRef<Mode>({ kind: "desk" });
  const firstFrame = useRef(true);
  const last = useRef<Pose | null>(null);
  const anchor = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const now = Date.now();
    const m = mode.current;
    // Leave when the break starts and the desk has no live task. A page opened
    // mid-break starts from the break's own start so everyone is already there.
    if (prayerBreak && m.kind !== "break" && !busy) {
      mode.current = { kind: "break", leftAt: firstFrame.current ? prayerBreak.start : now };
    } else if (!prayerBreak && m.kind === "break" && last.current) {
      mode.current = { kind: "return", from: [last.current.x, last.current.z], at: now };
    }
    firstFrame.current = false;

    const cur = mode.current;
    const pose =
      cur.kind === "break"
        ? breakPose(id, (now - cur.leftAt) / 1000)
        : cur.kind === "return"
          ? returnPose(id, cur.from, (now - cur.at) / 1000)
          : null;
    if (pose?.act === "desk" && cur.kind === "return") mode.current = { kind: "desk" };

    const g = root.current;
    if (!g) return;
    const away = !!pose && pose.act !== "desk";
    g.visible = away;
    if (away) awayFromDesk.add(id);
    else {
      awayFromDesk.delete(id);
      liveTagAnchors.delete(id);
    }
    if (!pose || !away) return;
    last.current = pose;

    const t = clock.elapsedTime + seed;
    const j = jointsFor(pose, t, seed);
    const k = 0.18;
    const fresh = g.userData.placed !== true;
    g.position.set(pose.x, 0, pose.z);
    g.rotation.y = fresh ? pose.yaw : angleEase(g.rotation.y, pose.yaw, 0.12);
    g.userData.placed = true;
    if (hips.current) hips.current.position.y = ease(hips.current.position.y, j.hip, fresh ? 1 : 0.3);
    const set = (ref: RefObject<THREE.Group | null>, axis: "x" | "y" | "z", v: number) => {
      if (ref.current) ref.current.rotation[axis] = fresh ? v : ease(ref.current.rotation[axis], v, k);
    };
    set(torso, "x", j.torso);
    set(thighL, "x", j.thighL);
    set(thighR, "x", j.thighR);
    set(shinL, "x", j.shinL);
    set(shinR, "x", j.shinR);
    set(armL, "x", j.upL);
    set(armR, "x", j.upR);
    set(armL, "z", j.sideL);
    set(armR, "z", j.sideR);
    set(foreL, "x", j.foreL);
    set(foreR, "x", j.foreR);
    set(head, "y", j.yaw);
    set(head, "x", j.pitch);
    if (mug.current) mug.current.visible = pose.holdingMug;

    const md = mood.current;
    md.talking = pose.act === "hang" && Math.sin(t * 0.6 + seed * 2) > 0.2 && j.foreR < 2;
    md.smile = ease(md.smile, pose.act === "stretch" ? 0.2 : 0.75, 0.1);
    md.brows = ease(md.brows, pose.act === "look" ? 0.5 : 0.15, 0.1);

    // Name tag follows the walker.
    anchor.set(pose.x, 2.25, pose.z);
    liveTagAnchors.set(id, anchor);
  });

  return (
    <group ref={root} visible={false}>
      <group ref={hips} position={[0, HIP_Y, 0]}>
        {(
          [
            [-0.11, thighL, shinL],
            [0.11, thighR, shinR],
          ] as const
        ).map(([x, thigh, shin]) => (
          <group key={x} ref={thigh} position={[x, 0, 0]}>
            <mesh position={[0, -0.23, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.32, 4, 10]} />
              <meshStandardMaterial color={PANTS} roughness={0.8} />
            </mesh>
            <group ref={shin} position={[0, -0.47, 0]}>
              <mesh position={[0, -0.22, 0]} castShadow>
                <capsuleGeometry args={[0.065, 0.3, 4, 10]} />
                <meshStandardMaterial color={PANTS} roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.45, -0.05]} castShadow>
                <boxGeometry args={[0.12, 0.07, 0.22]} />
                <meshStandardMaterial color={SHOE} roughness={0.6} />
              </mesh>
            </group>
          </group>
        ))}
        <group ref={torso}>
          <Upper profile={profile} armL={armL} armR={armR} foreL={foreL} foreR={foreR} head={head} mood={mood} seed={seed} mug={mug} />
        </group>
      </group>
    </group>
  );
}
