"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type * as THREE from "three";

export interface Mood {
  /** 0 neutral → 1 big smile. */
  smile: number;
  /** −1 worried/frowning brows → 1 raised (surprised/happy). */
  brows: number;
  talking: boolean;
}

/**
 * Eyes that blink, brows and a mouth that smiles or talks. Lives inside a
 * head group (sphere radius 0.17, facing −Z); the parent mutates `mood`.
 */
export function Face({ mood, seed }: { mood: RefObject<Mood>; seed: number }) {
  const eyes = useRef<THREE.Group>(null);
  const browL = useRef<THREE.Mesh>(null);
  const browR = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const nextBlink = useRef(1 + seed);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const m = mood.current;
    if (!eyes.current || !browL.current || !browR.current || !mouth.current) return;
    // Blink for ~0.13 s every 2.5–5.5 s.
    if (t > nextBlink.current + 0.13) nextBlink.current = t + 2.5 + ((Math.sin(t * 12.9 + seed) + 1) / 2) * 3;
    const closed = t > nextBlink.current;
    eyes.current.scale.y += ((closed ? 0.12 : 1) - eyes.current.scale.y) * 0.6;

    const lift = m.brows * 0.012;
    const tilt = m.brows * 0.25;
    browL.current.position.y += (0.07 + lift - browL.current.position.y) * 0.2;
    browR.current.position.y += (0.07 + lift - browR.current.position.y) * 0.2;
    browL.current.rotation.z += (-tilt - browL.current.rotation.z) * 0.2;
    browR.current.rotation.z += (tilt - browR.current.rotation.z) * 0.2;

    const open = m.talking ? 0.6 + Math.abs(Math.sin(t * 11 + seed)) * 1.6 : 0.6 + m.smile * 0.5;
    // Disc lies in local X/Z (rotated to face −Z), so local Z is its height.
    mouth.current.scale.set(1 + m.smile * 0.6, 1, open);
  });

  return (
    <group>
      <group ref={eyes} position={[0, 0.01, -0.155]}>
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <sphereGeometry args={[0.02, 10, 8]} />
            <meshStandardMaterial color="#0b0f19" roughness={0.3} />
          </mesh>
        ))}
        {/* Catch lights */}
        {[-0.054, 0.066].map((x) => (
          <mesh key={x} position={[x, 0.007, -0.016]}>
            <sphereGeometry args={[0.006, 6, 4]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
      <mesh ref={browL} position={[-0.06, 0.07, -0.158]}>
        <boxGeometry args={[0.05, 0.011, 0.01]} />
        <meshStandardMaterial color="#1a120d" />
      </mesh>
      <mesh ref={browR} position={[0.06, 0.07, -0.158]}>
        <boxGeometry args={[0.05, 0.011, 0.01]} />
        <meshStandardMaterial color="#1a120d" />
      </mesh>
      <mesh ref={mouth} position={[0, -0.07, -0.153]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.008, 16]} />
        <meshStandardMaterial color="#5a1f24" roughness={0.6} />
      </mesh>
    </group>
  );
}
