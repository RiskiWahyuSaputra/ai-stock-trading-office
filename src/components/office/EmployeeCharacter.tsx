"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type * as THREE from "three";
import type { AgentProfile } from "@/lib/domain/agents";
import { isWorking } from "@/lib/domain/agents";
import type { AgentStatus } from "@/lib/domain/schemas";
import { Face, type Mood } from "./Face";

const PANTS = "#1e2638";
const SHOE = "#0d111a";
const CONFETTI = ["#22d3ee", "#22c55e", "#f59e0b", "#a78bfa", "#f472b6", "#e6ecf7"];
const CELEBRATE_S = 2.6;
const PARTICLES = 8;
const CONFETTI_N = 22;

/** Smoothly move `v` toward `target` (frame-rate independent enough at 60 fps). */
const ease = (v: number, target: number, k: number) => v + (target - v) * k;

/**
 * Stylized seated office character built from primitives so every employee
 * shares one consistent art style; identity comes from color, hair and pose.
 * Faces −Z (toward the desk monitors). Effects (halo, data particles,
 * confetti, alert) only appear for the matching real workflow status.
 */
export function EmployeeCharacter({ profile, status }: { profile: AgentProfile; status: AgentStatus }) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Group>(null);
  const confetti = useRef<THREE.Group>(null);
  const alert = useRef<THREE.Group>(null);
  const mood = useRef<Mood>({ smile: 0.2, brows: 0, talking: false });
  const changedAt = useRef(-100);
  const prev = useRef<AgentStatus>(status);
  const seed = useMemo(() => profile.id.length * 1.7 + profile.name.length, [profile]);
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_N }, (_, i) => {
        const a = (i / CONFETTI_N) * Math.PI * 2 + seed;
        const sp = 0.6 + ((i * 37) % 10) / 12;
        return { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2.2 + ((i * 53) % 10) / 8, spin: 4 + (i % 5), color: CONFETTI[i % CONFETTI.length] };
      }),
    [seed],
  );

  useEffect(() => {
    if (prev.current !== status) {
      changedAt.current = performance.now() / 1000;
      prev.current = status;
    }
  }, [status]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const since = performance.now() / 1000 - changedAt.current;
    const working = isWorking(status);
    const celebrating = status === "completed" && since < CELEBRATE_S;
    const troubled = status === "failed" || status === "needs_attention";
    const idle = !working && !celebrating && !troubled;
    if (!root.current || !torso.current || !head.current || !armL.current || !armR.current || !foreL.current || !foreR.current) return;

    // Idle stretch every ~20 s, staggered per employee.
    const stretchT = (t * 1) % 20;
    const stretching = idle && stretchT > 16.5 && stretchT < 19;

    // Root: chair swivel when idle, little hop when celebrating, typing bounce when working.
    const swivel = idle ? Math.sin(t * 0.35) * 0.22 : 0;
    root.current.rotation.y = ease(root.current.rotation.y, swivel, 0.05);
    const hop = celebrating ? Math.abs(Math.sin(since * 9)) * 0.09 * (1 - since / CELEBRATE_S) : 0;
    const bounce = working ? Math.abs(Math.sin(t * 14)) * 0.008 : 0;
    root.current.position.y = hop + bounce;

    torso.current.scale.y = 1 + Math.sin(t * 2) * 0.012;
    torso.current.rotation.x = ease(torso.current.rotation.x, working ? 0.14 : troubled ? 0.2 : stretching ? -0.18 : -0.03, 0.1);

    let upperL = 0.55;
    let upperR = 0.55;
    let lowerL = 1.0;
    let lowerR = 1.0;
    let sideL = 0;
    let sideR = 0;

    if (working) {
      lowerL += Math.sin(t * 16) * 0.13;
      lowerR += Math.sin(t * 16 + Math.PI) * 0.13;
      if (profile.id === "technical" && Math.sin(t * 0.7) > 0.6) {
        upperR = 1.35; // point at the chart
        lowerR = 0.2;
      }
      if (profile.id === "officer" && Math.sin(t * 0.5) > 0.7) {
        upperL = 1.1; // hand on chin, reading the wall screen
        lowerL = 2.3;
      }
    } else if (celebrating) {
      upperL = upperR = 2.8;
      lowerL = lowerR = 0.25;
      sideL = 0.35 - Math.sin(since * 10) * 0.12;
      sideR = -0.35 + Math.sin(since * 10) * 0.12;
    } else if (troubled) {
      // Scratch the back of the head.
      upperR = 2.5;
      lowerR = 2.1 + Math.sin(t * 12) * 0.15;
      sideR = -0.25;
    } else if (stretching) {
      upperL = upperR = 3.0;
      lowerL = lowerR = 0.15;
      sideL = -0.2;
      sideR = 0.2;
    }

    armL.current.rotation.x = ease(armL.current.rotation.x, upperL, 0.15);
    armR.current.rotation.x = ease(armR.current.rotation.x, upperR, 0.15);
    armL.current.rotation.z = ease(armL.current.rotation.z, sideL, 0.15);
    armR.current.rotation.z = ease(armR.current.rotation.z, sideR, 0.15);
    foreL.current.rotation.x = ease(foreL.current.rotation.x, lowerL, 0.35);
    foreR.current.rotation.x = ease(foreR.current.rotation.x, lowerR, 0.35);

    // Head behaviour by role; idle people glance at a neighbour now and then.
    let yaw = Math.sin(t * 0.4) * 0.15;
    let pitch = 0.05;
    if (working) {
      if (profile.id === "news" || profile.id === "reviewer") yaw = Math.sin(t * 1.6) * 0.4;
      else if (profile.id === "technical") pitch = 0.12 + Math.sin(t * 3) * 0.05;
      else if (profile.id === "risk") yaw = Math.sin(t * 0.9) * 0.25;
      else pitch = 0.15 + Math.sin(t * 2.2) * 0.04;
    } else if (troubled) {
      pitch = 0.3;
      yaw = Math.sin(t * 2.5) * 0.15;
    } else if (celebrating) {
      pitch = -0.25;
      yaw = Math.sin(since * 6) * 0.2;
    } else if (stretching) {
      pitch = -0.3;
    } else if (Math.sin(t * 0.23) > 0.85) {
      yaw = Math.sign(Math.sin(t * 0.11)) * 0.9;
    }
    head.current.rotation.y = ease(head.current.rotation.y, yaw, 0.1);
    head.current.rotation.x = ease(head.current.rotation.x, pitch, 0.1);

    // Facial expression follows the status.
    const m = mood.current;
    m.smile = ease(m.smile, celebrating ? 1 : troubled ? -0.2 : working ? 0.1 : 0.35, 0.1);
    m.brows = ease(m.brows, celebrating ? 0.8 : troubled ? -0.9 : working ? -0.25 : 0, 0.1);
    m.talking = working && (profile.id === "reviewer" || profile.id === "officer") && Math.sin(t * 0.8) > 0.3;

    // Holographic halo + rising data while working.
    if (halo.current) {
      const s = ease(halo.current.scale.x, working ? 1 : 0.001, 0.12);
      halo.current.scale.setScalar(s);
      halo.current.visible = s > 0.01;
      halo.current.rotation.y = t * 1.8;
      halo.current.position.y = 1.72 + Math.sin(t * 3) * 0.02;
    }
    if (particles.current) {
      particles.current.visible = working;
      particles.current.children.forEach((p, i) => {
        const k = (t * 0.55 + i / PARTICLES) % 1;
        p.position.set(Math.sin(i * 2.1 + seed) * 0.45, 0.9 + k * 0.85, -0.75 + Math.cos(i * 1.3) * 0.08);
        p.rotation.set(t * 2 + i, t * 3, 0);
        p.scale.setScalar(Math.sin(k * Math.PI) * 1);
      });
    }

    // Confetti burst for a completed task.
    if (confetti.current) {
      confetti.current.visible = celebrating;
      if (celebrating) {
        confetti.current.children.forEach((c, i) => {
          const p = pieces[i];
          c.position.set(p.vx * since, 1.9 + p.vy * since - 2.6 * since * since, p.vz * since);
          c.rotation.set(since * p.spin, since * p.spin * 0.7, 0);
        });
      }
    }

    // Alert mark above the head when something needs attention.
    if (alert.current) {
      alert.current.visible = troubled;
      alert.current.position.y = 1.95 + Math.sin(t * 4) * 0.05;
      alert.current.rotation.y = Math.sin(t * 2) * 0.4;
    }
  });

  return (
    <group ref={root}>
      {/* Legs (seated) */}
      {[-0.11, 0.11].map((x) => (
        <group key={x} position={[x, 0.55, 0]}>
          <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.32, 4, 10]} />
            <meshStandardMaterial color={PANTS} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.25, -0.42]} castShadow>
            <capsuleGeometry args={[0.065, 0.32, 4, 10]} />
            <meshStandardMaterial color={PANTS} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.48, -0.47]} castShadow>
            <boxGeometry args={[0.12, 0.07, 0.22]} />
            <meshStandardMaterial color={SHOE} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Torso */}
      <group ref={torso} position={[0, 0.62, 0]}>
        <Upper profile={profile} armL={armL} armR={armR} foreL={foreL} foreR={foreR} head={head} mood={mood} seed={seed} />
      </group>

      {/* Effects */}
      <group ref={halo} visible={false}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.26, 0.012, 8, 40]} />
          <meshBasicMaterial color={profile.color} toneMapped={false} transparent opacity={0.85} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos((i * Math.PI * 2) / 3) * 0.26, 0, Math.sin((i * Math.PI * 2) / 3) * 0.26]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshBasicMaterial color="#e6ecf7" toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={particles} visible={false}>
        {Array.from({ length: PARTICLES }, (_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.03, 0.03, 0.03]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#e6ecf7" : profile.color} toneMapped={false} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
      <group ref={confetti} visible={false}>
        {pieces.map((p, i) => (
          <mesh key={i}>
            <planeGeometry args={[0.05, 0.03]} />
            <meshBasicMaterial color={p.color} toneMapped={false} side={2} />
          </mesh>
        ))}
      </group>
      <group ref={alert} visible={false}>
        <mesh position={[0, 0.07, 0]}>
          <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
          <meshBasicMaterial color="#f59e0b" toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.07, 0]}>
          <sphereGeometry args={[0.032, 10, 8]} />
          <meshBasicMaterial color="#f59e0b" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Torso contents shared by the seated and the standing figure: body, badge,
 * two-segment arms (optionally holding a mug) and the head with its face.
 */
export function Upper({
  profile,
  armL,
  armR,
  foreL,
  foreR,
  head,
  mood,
  seed,
  mug,
}: {
  profile: AgentProfile;
  armL: RefObject<THREE.Group | null>;
  armR: RefObject<THREE.Group | null>;
  foreL: RefObject<THREE.Group | null>;
  foreR: RefObject<THREE.Group | null>;
  head: RefObject<THREE.Group | null>;
  mood: RefObject<Mood>;
  seed: number;
  mug?: RefObject<THREE.Group | null>;
}) {
  return (
    <>
      <mesh position={[0, 0.28, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.3, 6, 14]} />
        <meshStandardMaterial color={profile.color} roughness={0.55} />
      </mesh>
      {/* Collar / lanyard badge */}
      <mesh position={[0, 0.5, -0.12]}>
        <boxGeometry args={[0.16, 0.05, 0.08]} />
        <meshStandardMaterial color="#e6ecf7" roughness={0.5} />
      </mesh>
      <mesh position={[0.08, 0.3, -0.2]}>
        <boxGeometry args={[0.07, 0.09, 0.01]} />
        <meshStandardMaterial color="#e6ecf7" emissive={profile.color} emissiveIntensity={0.4} />
      </mesh>

      {(
        [
          [-0.27, armL, foreL],
          [0.27, armR, foreR],
        ] as const
      ).map(([x, upper, fore]) => (
        <group key={x} ref={upper} position={[x, 0.5, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.2, 4, 10]} />
            <meshStandardMaterial color={profile.color} roughness={0.55} />
          </mesh>
          <group ref={fore} position={[0, -0.28, 0]}>
            <mesh position={[0, -0.12, 0]} castShadow>
              <capsuleGeometry args={[0.052, 0.18, 4, 10]} />
              <meshStandardMaterial color={profile.color} roughness={0.55} />
            </mesh>
            <mesh position={[0, -0.27, 0]}>
              <sphereGeometry args={[0.055, 12, 10]} />
              <meshStandardMaterial color={profile.skin} roughness={0.7} />
            </mesh>
            {mug && x > 0 && (
              <group ref={mug} position={[0, -0.3, -0.05]} visible={false}>
                <mesh>
                  <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
                </mesh>
                <mesh position={[0, 0.048, 0]}>
                  <cylinderGeometry args={[0.038, 0.038, 0.004, 14]} />
                  <meshStandardMaterial color="#4a2c1a" roughness={0.3} />
                </mesh>
                <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.022, 0.007, 6, 12]} />
                  <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
                </mesh>
              </group>
            )}
          </group>
        </group>
      ))}

      <group ref={head} position={[0, 0.78, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.1, 10]} />
          <meshStandardMaterial color={profile.skin} roughness={0.7} />
        </mesh>
        <mesh castShadow>
          <sphereGeometry args={[0.17, 20, 16]} />
          <meshStandardMaterial color={profile.skin} roughness={0.65} />
        </mesh>
        {/* Hair cap */}
        <mesh position={[0, 0.05, 0.03]} scale={[1.06, 0.9, 1.06]} castShadow>
          <sphereGeometry args={[0.17, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial color={profile.hair} roughness={0.9} />
        </mesh>
        <Face mood={mood} seed={seed} />
        {/* Headset */}
        <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.18, 0.012, 6, 24, Math.PI]} />
          <meshStandardMaterial color="#1b2333" metalness={0.4} roughness={0.4} />
        </mesh>
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color="#1b2333" emissive={profile.color} emissiveIntensity={0.25} />
          </mesh>
        ))}
      </group>
    </>
  );
}
