"use client";

import {
  CameraControls,
  ContactShadows,
  PerformanceMonitor,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AGENT_ORDER, AGENTS } from "@/lib/domain/agents";
import type { AgentId } from "@/lib/domain/schemas";
import { useOffice } from "@/lib/store/office-store";
import { useOfficeCamera } from "./camera-store";
import { EmployeeDesk } from "./EmployeeDesk";
import { DEFAULT_VIEW, DESKS, focusView, ROOM } from "./layout";
import { NameTags } from "./NameTags";
import { BreakWalker } from "./BreakWalker";
import { COUNTER_X, LOUNGE_TABLE } from "./break-routine";
import { liveTagAnchors } from "./presence";
import { tagAnchor, tagElements } from "./tag-anchors";

function Room() {
  const { width: W, depth: D, height: H } = ROOM;
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#1a2438" roughness={0.8} />
      </mesh>
      {/* Floor tiles */}
      <gridHelper
        args={[W, 16, "#24314d", "#202b44"]}
        position={[0, 0.002, 0]}
      />
      {/* Rug under the analyst pod */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.004, 1.8]}
        receiveShadow
      >
        <planeGeometry args={[11.5, 3.6]} />
        <meshStandardMaterial color="#223050" roughness={1} />
      </mesh>
      {/* Officer platform */}
      <mesh position={[0, 0.05, -2.6]} receiveShadow castShadow>
        <boxGeometry args={[5, 0.1, 3]} />
        <meshStandardMaterial color="#182238" roughness={0.7} />
      </mesh>

      {/* Back wall with city windows */}
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#18213a" roughness={0.9} />
      </mesh>
      {[-5.5, 5.5].map((x) => (
        <group key={x} position={[x, 2.2, -D / 2 + 0.02]}>
          <mesh>
            <planeGeometry args={[4, 2.4]} />
            <meshBasicMaterial color="#0b1a33" toneMapped={false} />
          </mesh>
          {Array.from({ length: 18 }, (_, i) => (
            <mesh
              key={i}
              position={[
                -1.7 + (i % 9) * 0.42,
                -1.05 + ((i * 7) % 5) * 0.12 + 0.25,
                0.005,
              ]}
            >
              <planeGeometry args={[0.28, 0.5 + ((i * 13) % 7) * 0.18]} />
              <meshBasicMaterial
                color={i % 4 === 0 ? "#1d3b66" : "#132a4a"}
                toneMapped={false}
              />
            </mesh>
          ))}
          {[-1, 0, 1].map((m) => (
            <mesh key={m} position={[m * 1.33, 0, 0.01]}>
              <boxGeometry args={[0.04, 2.4, 0.02]} />
              <meshStandardMaterial color="#1f2b44" />
            </mesh>
          ))}
        </group>
      ))}
      {/* Company sign */}
      <mesh position={[0, 3.75, -D / 2 + 0.03]}>
        <planeGeometry args={[3.2, 0.06]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>

      {/* Left wall */}
      <mesh
        position={[-W / 2, H / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color="#151e33" roughness={0.9} />
      </mesh>
      {/* Glass partition behind the officer */}
      <mesh position={[-3.2, 1.2, -1.1]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.6, 2.4, 0.03]} />
        <meshStandardMaterial
          color="#5fb7d9"
          transparent
          opacity={0.08}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[3.2, 1.2, -1.1]}>
        <boxGeometry args={[1.6, 2.4, 0.03]} />
        <meshStandardMaterial
          color="#5fb7d9"
          transparent
          opacity={0.08}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Plants */}
      {[
        [-7, -5],
        [7, -5],
        [-7, 4.6],
        [6.8, 4.4],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.2, 0.5, 14]} />
            <meshStandardMaterial color="#2a3550" />
          </mesh>
          <mesh position={[0, 0.85, 0]} castShadow>
            <icosahedronGeometry args={[0.48, 1]} />
            <meshStandardMaterial color="#1f6f4a" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}

      {/* Coffee/meeting table */}
      <group position={[5.6, 0, -3.6]}>
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.8, 0.8, 0.05, 28]} />
          <meshStandardMaterial color="#2a3550" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.06, 0.12, 0.72, 10]} />
          <meshStandardMaterial color="#151c2c" />
        </mesh>
      </group>
    </group>
  );
}

const LOUNGE_VIEW = {
  position: [LOUNGE_TABLE[0] - 4.2, 4.6, LOUNGE_TABLE[1] + 6.2] as [number, number, number],
  target: [LOUNGE_TABLE[0] + 0.4, 0.9, LOUNGE_TABLE[1] - 0.2] as [number, number, number],
};

/** Coffee corner: counter with an espresso machine, mugs and a pendant lamp over the table. */
function Lounge() {
  const steam = useRef<THREE.Group>(null);
  const onBreak = useOffice((s) => !!s.prayerBreak);
  useFrame(({ clock }) => {
    if (!steam.current) return;
    steam.current.visible = onBreak;
    steam.current.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.5 + i / 3) % 1;
      c.position.set(Math.sin(k * 6 + i) * 0.03, 0.15 + k * 0.35, 0);
      c.scale.setScalar(0.5 + k);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k);
    });
  });
  const [tx, tz] = LOUNGE_TABLE;
  return (
    <group>
      {/* Counter along the right side */}
      <mesh position={[COUNTER_X, 0.47, -3.75]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.94, 3.0]} />
        <meshStandardMaterial color="#1f2a42" roughness={0.6} />
      </mesh>
      <mesh position={[COUNTER_X, 0.955, -3.75]} receiveShadow>
        <boxGeometry args={[0.6, 0.03, 3.05]} />
        <meshStandardMaterial color="#c8b38a" roughness={0.35} />
      </mesh>
      <mesh position={[COUNTER_X - 0.28, 0.62, -3.75]}>
        <boxGeometry args={[0.01, 0.02, 2.9]} />
        <meshBasicMaterial color="#f59e0b" toneMapped={false} />
      </mesh>
      {/* Espresso machine */}
      <group position={[COUNTER_X + 0.02, 0.97, -4.55]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.42, 0.4, 0.5]} />
          <meshStandardMaterial color="#9aa6b8" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[-0.2, 0.28, 0]}>
          <boxGeometry args={[0.02, 0.1, 0.3]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
        <mesh position={[-0.16, 0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 10]} />
          <meshStandardMaterial color="#1b2333" metalness={0.6} />
        </mesh>
        <group ref={steam} position={[-0.16, 0.05, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshBasicMaterial color="#e6ecf7" transparent opacity={0.3} depthWrite={false} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Mugs and a jar */}
      {[-3.9, -3.75, -3.6].map((z) => (
        <mesh key={z} position={[COUNTER_X, 1.02, z - 0.1]} castShadow>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 12]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[COUNTER_X, 1.06, -2.7]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.18, 14]} />
        <meshStandardMaterial color="#5fb7d9" transparent opacity={0.45} roughness={0.1} />
      </mesh>
      {/* Pendant lamp above the table */}
      <group position={[tx, 3.0, tz]}>
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 1.2, 4]} />
          <meshStandardMaterial color="#0d111a" />
        </mesh>
        <mesh>
          <coneGeometry args={[0.32, 0.28, 24, 1, true]} />
          <meshStandardMaterial color="#f59e0b" side={THREE.DoubleSide} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshBasicMaterial color="#fff3d6" toneMapped={false} />
        </mesh>
        <pointLight position={[0, -0.2, 0]} color="#ffd9a0" intensity={onBreak ? 5 : 2} distance={5} decay={2} />
      </group>
    </group>
  );
}

const HANDOFF_MS = 1_100;

/**
 * A glowing report sheet that flies along an arc from one desk to the next
 * whenever an agent hands its finished output over (a real `handoff` event).
 */
function HandoffPacket() {
  const handoff = useOffice((s) => s.handoff);
  const ref = useRef<THREE.Group>(null);
  const started = useRef<{ id: string; at: number } | null>(null);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || !handoff) return;
    if (started.current?.id !== handoff.id) started.current = { id: handoff.id, at: clock.elapsedTime };
    const t = (clock.elapsedTime - started.current.at) / (HANDOFF_MS / 1000);
    g.visible = t < 1;
    if (!g.visible) return;
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const [ax, , az] = DESKS[handoff.from].position;
    const [bx, , bz] = DESKS[handoff.to].position;
    g.position.set(ax + (bx - ax) * e, 1.3 + Math.sin(Math.PI * e) * 1.6, az + (bz - az) * e);
    g.rotation.set(-0.4, clock.elapsedTime * 4, Math.sin(clock.elapsedTime * 6) * 0.2);
  });

  if (!handoff) return null;
  const color = AGENTS[handoff.from].color;
  return (
    <group ref={ref} visible={false}>
      <mesh castShadow>
        <boxGeometry args={[0.34, 0.02, 0.44]} />
        <meshStandardMaterial color="#e6ecf7" emissive={color} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={3} distance={2.5} />
    </group>
  );
}

function CameraRig() {
  const controls = useRef<CameraControls>(null);
  const focus = useOfficeCamera((s) => s.focus);
  const nonce = useOfficeCamera((s) => s.nonce);
  const followActive = useOfficeCamera((s) => s.followActive);
  const activeAgent = useOffice((s) =>
    s.run?.phase === "running" ? s.activeAgent : null,
  );
  const onBreak = useOffice((s) => !!s.prayerBreak && s.run?.phase !== "running");

  const target: AgentId | null = focus ?? (followActive ? activeAgent : null);
  // During the break, "follow" frames the coffee corner where everyone is.
  const lounge = !focus && followActive && onBreak;

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const v = lounge ? LOUNGE_VIEW : target ? focusView(target) : DEFAULT_VIEW;
    void c.setLookAt(...v.position, ...v.target, true);
  }, [target, nonce, lounge]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={3}
      maxDistance={24}
      minPolarAngle={0.25}
      maxPolarAngle={1.35}
      smoothTime={0.6}
      draggingSmoothTime={0.15}
    />
  );
}

/** Projects each desk's tag anchor to screen space and moves the DOM tag. */
function TagProjector() {
  const anchors = useMemo(
    () =>
      AGENT_ORDER.map(
        (id) => [id, new THREE.Vector3(...tagAnchor(id))] as const,
      ),
    [],
  );
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const [id, anchor] of anchors) {
      const el = tagElements.get(id);
      if (!el) continue;
      v.copy(liveTagAnchors.get(id) ?? anchor).project(camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.style.visibility = visible ? "visible" : "hidden";
      if (!visible) continue;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const dist = camera.position.distanceTo(liveTagAnchors.get(id) ?? anchor);
      // Shrink tags on small canvases so they do not bury the characters.
      const fit = THREE.MathUtils.clamp(size.width / 1000, 0.55, 1);
      const scale = THREE.MathUtils.clamp(11 / dist, 0.6, 1) * fit;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      el.style.zIndex = String(Math.round(1000 - dist * 10));
    }
  });
  return null;
}

/**
 * The interactive 3D office. Loaded client-side only (WebGL); see OfficeView
 * for the 2D fallback.
 */
export default function OfficeScene({
  onOpenAgent,
}: {
  onOpenAgent: (id: AgentId) => void;
}) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={dpr}
        camera={{
          position: DEFAULT_VIEW.position,
          fov: 40,
          near: 0.1,
          far: 80,
        }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => useOffice.getState().selectAgent(null)}
      >
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(1.5)}
        />
        <color attach="background" args={["#070b16"]} />
        <fog attach="fog" args={["#070b16", 22, 40]} />
        <hemisphereLight args={["#b9c8ff", "#1a2235", 1.1]} />
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[6, 10, 6]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
          shadow-bias={-0.0005}
        />
        <pointLight
          position={[0, 3.6, 1]}
          intensity={8}
          distance={14}
          color="#dbe8ff"
        />
        <pointLight
          position={[0, 3.4, -3]}
          intensity={4}
          distance={8}
          color="#bff3ff"
        />
        <Room />
        <ContactShadows
          position={[0, 0.01, 0]}
          scale={18}
          blur={2.2}
          opacity={0.45}
          far={2}
          frames={1}
        />
        {AGENT_ORDER.map((id) => (
          <EmployeeDesk key={id} id={id} onOpen={onOpenAgent} />
        ))}
        <Lounge />
        {AGENT_ORDER.map((id) => (
          <BreakWalker key={id} id={id} />
        ))}
        <HandoffPacket />
        <CameraRig />
        <TagProjector />
      </Canvas>
      <NameTags onOpen={onOpenAgent} />
    </div>
  );
}
