"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type * as THREE from "three";
import type { AgentProfile } from "@/lib/domain/agents";
import { isWorking } from "@/lib/domain/agents";
import type { AgentStatus } from "@/lib/domain/schemas";

const PANTS = "#1e2638";
const SHOE = "#0d111a";

/**
 * Stylized seated office character built from primitives so every employee
 * shares one consistent art style; identity comes from color, hair and pose.
 * Faces −Z (toward the desk monitors).
 */
export function EmployeeCharacter({
  profile,
  status,
}: {
  profile: AgentProfile;
  status: AgentStatus;
}) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const changedAt = useRef(0);
  const prev = useRef<AgentStatus>(status);
  const offset = useRef(profile.id.length * 1.7);

  useEffect(() => {
    if (prev.current !== status) {
      changedAt.current = performance.now() / 1000;
      prev.current = status;
    }
  }, [status]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + offset.current;
    const now = performance.now() / 1000;
    const since = now - changedAt.current;
    const working = isWorking(status);
    const celebrating = status === "completed" && since < 2.5;
    const troubled = status === "failed" || status === "needs_attention";
    if (
      !torso.current ||
      !head.current ||
      !armL.current ||
      !armR.current ||
      !foreL.current ||
      !foreR.current
    )
      return;

    // Breathing + lean
    torso.current.scale.y = 1 + Math.sin(t * 2) * 0.012;
    torso.current.rotation.x = working ? 0.12 : troubled ? 0.18 : -0.03;

    // Arms resting toward desk by default
    const upperL = 0.55;
    let upperR = 0.55;
    let lowerL = 1.0;
    let lowerR = 1.0;
    let sideR = 0;

    if (working) {
      lowerL += Math.sin(t * 14) * 0.12;
      lowerR += Math.sin(t * 14 + Math.PI) * 0.12;
      if (profile.id === "technical") {
        // Point at the chart now and then
        const point = Math.sin(t * 0.7) > 0.6;
        if (point) {
          upperR = 1.35;
          lowerR = 0.2;
        }
      }
    } else if (celebrating) {
      upperR = 2.7;
      lowerR = 0.3;
      sideR = -0.35 + Math.sin(since * 10) * 0.08;
    } else if (troubled) {
      upperR = 2.3;
      lowerR = 1.9;
      sideR = -0.2;
    }

    const k = 0.15; // smoothing
    armL.current.rotation.x += (upperL - armL.current.rotation.x) * k;
    armR.current.rotation.x += (upperR - armR.current.rotation.x) * k;
    armR.current.rotation.z += (sideR - armR.current.rotation.z) * k;
    foreL.current.rotation.x += (lowerL - foreL.current.rotation.x) * 0.35;
    foreR.current.rotation.x += (lowerR - foreR.current.rotation.x) * 0.35;

    // Head behaviour by role
    let yaw = Math.sin(t * 0.4) * 0.15;
    let pitch = 0.05;
    if (working) {
      if (profile.id === "news" || profile.id === "reviewer")
        yaw = Math.sin(t * 1.6) * 0.4;
      else if (profile.id === "technical")
        pitch = 0.12 + Math.sin(t * 3) * 0.05;
      else if (profile.id === "risk") yaw = Math.sin(t * 0.9) * 0.25;
      else pitch = 0.15;
    } else if (troubled) {
      pitch = 0.3;
      yaw = Math.sin(t * 2.5) * 0.15;
    } else if (celebrating) {
      pitch = -0.2;
    }
    head.current.rotation.y += (yaw - head.current.rotation.y) * 0.1;
    head.current.rotation.x += (pitch - head.current.rotation.x) * 0.1;
  });

  return (
    <group>
      {/* Legs (seated) */}
      {[-0.11, 0.11].map((x) => (
        <group key={x} position={[x, 0.55, 0]}>
          <mesh
            position={[0, 0, -0.2]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
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
          <meshStandardMaterial
            color="#e6ecf7"
            emissive={profile.color}
            emissiveIntensity={0.4}
          />
        </mesh>

        {/* Arms */}
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
            </group>
          </group>
        ))}

        {/* Head */}
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
            <sphereGeometry
              args={[0.17, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.7]}
            />
            <meshStandardMaterial color={profile.hair} roughness={0.9} />
          </mesh>
          {/* Eyes & headset */}
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0.01, -0.155]}>
              <sphereGeometry args={[0.018, 8, 6]} />
              <meshStandardMaterial color="#0b0f19" />
            </mesh>
          ))}
          <mesh position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.18, 0.012, 6, 24, Math.PI]} />
            <meshStandardMaterial
              color="#1b2333"
              metalness={0.4}
              roughness={0.4}
            />
          </mesh>
          {[-0.18, 0.18].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.04, 10, 8]} />
              <meshStandardMaterial
                color="#1b2333"
                emissive={profile.color}
                emissiveIntensity={0.25}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
