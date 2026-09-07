"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds } from "@react-three/drei";

function MannequinGeometry() {
  return (
    <group>
      {/* Head */}
      <mesh position={[0, 1.75, 0]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.16, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Torso */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.22, 0.18, 0.7, 16]} />
        <meshStandardMaterial color="#c0a882" />
      </mesh>

      {/* Hips */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.28, 16]} />
        <meshStandardMaterial color="#c0a882" />
      </mesh>

      {/* Left upper arm */}
      <mesh position={[-0.35, 1.2, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.065, 0.055, 0.38, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Right upper arm */}
      <mesh position={[0.35, 1.2, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.065, 0.055, 0.38, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Left forearm */}
      <mesh position={[-0.46, 0.88, 0]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.05, 0.04, 0.34, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Right forearm */}
      <mesh position={[0.46, 0.88, 0]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.05, 0.04, 0.34, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Left thigh */}
      <mesh position={[-0.11, 0.35, 0]}>
        <cylinderGeometry args={[0.1, 0.085, 0.46, 12]} />
        <meshStandardMaterial color="#c0a882" />
      </mesh>

      {/* Right thigh */}
      <mesh position={[0.11, 0.35, 0]}>
        <cylinderGeometry args={[0.1, 0.085, 0.46, 12]} />
        <meshStandardMaterial color="#c0a882" />
      </mesh>

      {/* Left shin */}
      <mesh position={[-0.11, -0.08, 0]}>
        <cylinderGeometry args={[0.075, 0.06, 0.44, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Right shin */}
      <mesh position={[0.11, -0.08, 0]}>
        <cylinderGeometry args={[0.075, 0.06, 0.44, 12]} />
        <meshStandardMaterial color="#d4b89a" />
      </mesh>

      {/* Left foot */}
      <mesh position={[-0.11, -0.35, 0.04]}>
        <boxGeometry args={[0.1, 0.07, 0.2]} />
        <meshStandardMaterial color="#8a7060" />
      </mesh>

      {/* Right foot */}
      <mesh position={[0.11, -0.35, 0.04]}>
        <boxGeometry args={[0.1, 0.07, 0.2]} />
        <meshStandardMaterial color="#8a7060" />
      </mesh>
    </group>
  );
}

export default function DemoOutfitModel() {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-1">
        <Canvas camera={{ position: [0, 1, 3.2], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 6, 4]} intensity={1.2} />
          <directionalLight position={[-4, 2, -4]} intensity={0.4} />
          <Bounds fit clip observe margin={1.2}>
            <MannequinGeometry />
          </Bounds>
          <OrbitControls makeDefault enablePan enableZoom enableRotate />
        </Canvas>

        {/* Overlay label — announced to assistive tech (fallback state, normal DOM). */}
        <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
          <span
            role="status"
            aria-live="polite"
            className="rounded-full bg-muted/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm"
          >
            No 3D model available — demo mannequin
          </span>
        </div>
      </div>
    </div>
  );
}
