"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

/* ─── body-type-aware mannequin ───────────────── */

interface MannequinProps {
  bodyType: "female" | "male" | "neutral";
  heightScale: number;
  weightScale: number;
}

function Mannequin({ bodyType, heightScale, weightScale }: MannequinProps) {
  const ref = useRef<Group>(null);

  const target = useMemo(() => {
    const h = 0.88 + heightScale * 0.24;
    const w = 0.92 + weightScale * 0.16;
    return new Vector3(w, h, w);
  }, [heightScale, weightScale]);

  const p = useMemo(() => {
    switch (bodyType) {
      case "female":
        return { s: 0.19, h: 0.23, t: 0.9 };
      case "male":
        return { s: 0.25, h: 0.19, t: 1.1 };
      default:
        return { s: 0.22, h: 0.2, t: 1.0 };
    }
  }, [bodyType]);

  useFrame(() => {
    if (ref.current) ref.current.scale.lerp(target, 0.06);
  });

  const skin = "#d4b89a";
  const body = "#c0a882";
  const shoe = "#8a7060";

  return (
    <group ref={ref}>
      {/* Head */}
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[p.s, p.h * 0.9, 0.7, 16]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* Hips */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[p.h * 0.95, p.h, 0.28, 16]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* Left upper arm */}
      <mesh position={[-0.35, 1.2, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.065 * p.t, 0.055 * p.t, 0.38, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Right upper arm */}
      <mesh position={[0.35, 1.2, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.065 * p.t, 0.055 * p.t, 0.38, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Left forearm */}
      <mesh position={[-0.46, 0.88, 0]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.05 * p.t, 0.04 * p.t, 0.34, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Right forearm */}
      <mesh position={[0.46, 0.88, 0]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.05 * p.t, 0.04 * p.t, 0.34, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Left thigh */}
      <mesh position={[-0.11, 0.35, 0]}>
        <cylinderGeometry args={[0.1 * p.t, 0.085 * p.t, 0.46, 12]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* Right thigh */}
      <mesh position={[0.11, 0.35, 0]}>
        <cylinderGeometry args={[0.1 * p.t, 0.085 * p.t, 0.46, 12]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* Left shin */}
      <mesh position={[-0.11, -0.08, 0]}>
        <cylinderGeometry args={[0.075 * p.t, 0.06 * p.t, 0.44, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Right shin */}
      <mesh position={[0.11, -0.08, 0]}>
        <cylinderGeometry args={[0.075 * p.t, 0.06 * p.t, 0.44, 12]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      {/* Left foot */}
      <mesh position={[-0.11, -0.35, 0.04]}>
        <boxGeometry args={[0.1, 0.07, 0.2]} />
        <meshStandardMaterial color={shoe} roughness={0.5} />
      </mesh>
      {/* Right foot */}
      <mesh position={[0.11, -0.35, 0.04]}>
        <boxGeometry args={[0.1, 0.07, 0.2]} />
        <meshStandardMaterial color={shoe} roughness={0.5} />
      </mesh>
    </group>
  );
}

/* ─── exported viewer canvas ──────────────────── */

interface TryOnViewerProps {
  bodyType: "female" | "male" | "neutral";
  heightScale: number;
  weightScale: number;
  enableOrbit?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export default function TryOnViewer({
  bodyType,
  heightScale,
  weightScale,
  enableOrbit = false,
  autoRotate = true,
  autoRotateSpeed = 1.5,
}: TryOnViewerProps) {
  // WCAG 2.2.2 — JS-driven auto-rotation must stop when the user prefers reduced motion.
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <Canvas
      camera={{ position: [0, 0.9, 3], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 4]} intensity={0.9} color="#fff5ee" />
      <directionalLight
        position={[-3, 2, -3]}
        intensity={0.25}
        color="#7a2e3a"
      />
      <pointLight
        position={[0, 3, 2]}
        intensity={0.15}
        color="#7a2e3a"
        distance={8}
      />
      <Mannequin
        bodyType={bodyType}
        heightScale={heightScale}
        weightScale={weightScale}
      />
      <OrbitControls
        makeDefault
        target={[0, 0.9, 0]}
        enablePan={enableOrbit}
        enableZoom={enableOrbit}
        enableRotate
        autoRotate={autoRotate && !prefersReducedMotion}
        autoRotateSpeed={autoRotateSpeed}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.7}
      />
    </Canvas>
  );
}
