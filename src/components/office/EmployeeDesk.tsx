"use client";

import { RoundedBox, useCursor } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AGENTS, isWorking } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { EmployeeCharacter } from "./EmployeeCharacter";
import { DESKS } from "./layout";
import { createScreen, type ScreenHandle } from "./screens";

const DESK_TOP = "#2a3550";
const DESK_FRAME = "#151c2c";
const MONITOR = "#0b0f19";

function Monitor({
  screen,
  position,
  rotationY = 0,
  size = [0.62, 0.38],
}: {
  screen: ScreenHandle;
  position: [number, number, number];
  rotationY?: number;
  size?: [number, number];
}) {
  const [w, h] = size;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w + 0.04, h + 0.04, 0.03]} />
        <meshStandardMaterial color={MONITOR} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={screen.texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.08, -0.02]}>
        <boxGeometry args={[0.04, 0.16, 0.04]} />
        <meshStandardMaterial color={MONITOR} />
      </mesh>
    </group>
  );
}

/**
 * One workstation: desk, chair, monitors, the employee and a selection ring,
 * all driven by live status from the workflow store.
 */
export function EmployeeDesk({
  id,
  onOpen,
}: {
  id: AgentId;
  onOpen: (id: AgentId) => void;
}) {
  const profile = AGENTS[id];
  const spot = DESKS[id];
  const agent = useOffice((s) => s.agents[id]);
  const selected = useOffice((s) => s.selectedAgent === id);
  const active = useOffice(
    (s) => s.activeAgent === id && s.run?.phase === "running",
  );
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ring = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const lastDraw = useRef(0);
  const control = spot.variant === "control";

  const screens = useMemo(() => {
    const count = control ? 3 : id === "reviewer" ? 3 : 2;
    return Array.from({ length: count }, (_, i) =>
      createScreen(id, profile.color, i % 2),
    );
  }, [id, control, profile.color]);
  const wall = useMemo(
    () => (control ? createScreen("officer", profile.color, 0) : null),
    [control, profile.color],
  );

  useEffect(
    () => () => {
      screens.forEach((s) => s.texture.dispose());
      wall?.texture.dispose();
    },
    [screens, wall],
  );

  // Redraw screens on status change immediately.
  useEffect(() => {
    screens.forEach((s) => s.draw(0, agent.status, agent.symbol));
    wall?.draw(0, agent.status, agent.symbol);
  }, [agent.status, agent.symbol, screens, wall]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const working = isWorking(agent.status);
    // Screens animate at ~6 fps and only while real work is in progress.
    if (working && t - lastDraw.current > 0.16) {
      lastDraw.current = t;
      screens.forEach((s) => s.draw(t, agent.status, agent.symbol));
      wall?.draw(t, agent.status, agent.symbol);
    }
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      const target = selected
        ? 0.9
        : active
          ? 0.45 + Math.sin(t * 4) * 0.3
          : hovered
            ? 0.35
            : 0;
      m.opacity += (target - m.opacity) * 0.15;
      ring.current.visible = m.opacity > 0.01;
    }
    if (glow.current)
      glow.current.intensity = working ? 1.6 + Math.sin(t * 6) * 0.2 : 0.6;
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onOpen(id);
  };

  const deskW = control ? 2.6 : 1.6;

  return (
    <group position={spot.position} rotation={[0, spot.rotation, 0]}>
      <group
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Desk */}
        <RoundedBox
          args={[deskW, 0.06, 0.85]}
          radius={0.02}
          position={[0, 0.76, -0.2]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={DESK_TOP}
            roughness={0.5}
            metalness={0.1}
          />
        </RoundedBox>
        <mesh position={[0, 0.76, 0.225]}>
          <boxGeometry args={[deskW, 0.02, 0.01]} />
          <meshBasicMaterial color={profile.color} toneMapped={false} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[(s * deskW) / 2 - s * 0.06, 0.37, -0.2]}
            castShadow
          >
            <boxGeometry args={[0.05, 0.74, 0.75]} />
            <meshStandardMaterial color={DESK_FRAME} />
          </mesh>
        ))}
        {/* Keyboard */}
        <mesh position={[0, 0.8, 0.02]}>
          <boxGeometry args={[0.45, 0.02, 0.15]} />
          <meshStandardMaterial color="#1b2333" />
        </mesh>

        {/* Monitors */}
        {screens.map((s, i) => {
          const n = screens.length;
          const spread = control ? 0.72 : 0.66;
          const x = (i - (n - 1) / 2) * spread;
          const rot = n > 1 ? -(i - (n - 1) / 2) * 0.28 : 0;
          return (
            <Monitor
              key={i}
              screen={s}
              position={[x, 1.12, -0.45 + Math.abs(x) * 0.12]}
              rotationY={rot}
            />
          );
        })}
        {wall && (
          <group position={[0, 2.1, -1.55]}>
            <Monitor screen={wall} position={[0, 0, 0]} size={[2.8, 1.5]} />
          </group>
        )}
        <pointLight
          ref={glow}
          position={[0, 1.2, -0.1]}
          color={profile.color}
          distance={2.2}
          decay={2}
          intensity={0.6}
        />

        {/* Chair */}
        <group position={[0, 0, 0.62]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.5, 0.07, 0.48]} />
            <meshStandardMaterial color="#20293d" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.88, 0.24]} rotation={[-0.1, 0, 0]} castShadow>
            <boxGeometry args={[0.48, 0.7, 0.06]} />
            <meshStandardMaterial color="#20293d" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.45, 8]} />
            <meshStandardMaterial
              color="#0d111a"
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.03, 16]} />
            <meshStandardMaterial
              color="#0d111a"
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
          <EmployeeCharacter profile={profile} status={agent.status} />
        </group>
      </group>

      {/* Selection / activity ring */}
      <mesh
        ref={ring}
        position={[0, 0.015, 0.25]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[1.0, 1.08, 48]} />
        <meshBasicMaterial
          color={profile.color}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
