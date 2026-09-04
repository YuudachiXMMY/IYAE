"use client";
// AR Viewer — WebXR immersive-ar session via @react-three/xr v6
// Placed inside a full-screen Canvas; models are composited over
// the real-world camera feed once the XR session starts.

import { Suspense, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  XR,
  createXRStore,
  useXRHitTest,
  IfInSessionMode,
  XROrigin,
} from "@react-three/xr";
import * as THREE from "three";

interface ARViewerProps {
  glbUrls: string[];
  onExit?: () => void;
}

// Reticle rendered at hit-test position to guide placement
function HitTestReticle({
  onHitMatrix,
}: {
  onHitMatrix: (m: THREE.Matrix4) => void;
}) {
  const reticleRef = useRef<THREE.Mesh>(null);

  useXRHitTest(
    useCallback(
      (
        results: XRHitTestResult[],
        getWorldMatrix: (target: THREE.Matrix4, result: XRHitTestResult) => boolean
      ) => {
        if (results.length === 0) {
          if (reticleRef.current) reticleRef.current.visible = false;
          return;
        }
        const mat = new THREE.Matrix4();
        const ok = getWorldMatrix(mat, results[0]);
        if (!ok) return;
        if (reticleRef.current) {
          reticleRef.current.visible = true;
          mat.decompose(
            reticleRef.current.position,
            reticleRef.current.quaternion,
            reticleRef.current.scale
          );
        }
        onHitMatrix(mat);
      },
      [onHitMatrix]
    ),
    "viewer"
  );

  return (
    <mesh ref={reticleRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.08, 0.12, 32]} />
      <meshStandardMaterial
        color="#a855f7"
        transparent
        opacity={0.75}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// Placed GLB model at a fixed world matrix position
function PlacedModel({
  url,
  matrix,
}: {
  url: string;
  matrix: THREE.Matrix4;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={quaternion}
    >
      <primitive object={scene.clone()} scale={1} />
    </group>
  );
}

// AR scene content — only rendered inside an XR session
function ARScene({
  glbUrls,
  placementMatrix,
  placed,
  onHitMatrix,
}: {
  glbUrls: string[];
  placementMatrix: THREE.Matrix4 | null;
  placed: boolean;
  onHitMatrix: (m: THREE.Matrix4) => void;
}) {
  return (
    <>
      <XROrigin />
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 2]} intensity={1} castShadow />

      {!placed && <HitTestReticle onHitMatrix={onHitMatrix} />}

      {placed && placementMatrix && glbUrls.length > 0 && (
        <Suspense fallback={null}>
          {glbUrls.slice(0, 1).map((url) => (
            <PlacedModel key={url} url={url} matrix={placementMatrix} />
          ))}
        </Suspense>
      )}
    </>
  );
}

// Pre-AR 3D preview panel (non-XR view)
function PreviewScene({ glbUrls }: { glbUrls: string[] }) {
  if (glbUrls.length === 0) return null;
  return (
    <Suspense fallback={null}>
      {glbUrls.slice(0, 1).map((url) => (
        <PlacedModel
          key={url}
          url={url}
          matrix={new THREE.Matrix4().setPosition(0, -0.8, -2)}
        />
      ))}
    </Suspense>
  );
}

// XR session not supported message
function XRNotSupported() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-5 text-center shadow-lg">
      <p className="text-sm font-semibold text-foreground">
        WebXR Not Supported
      </p>
      <p className="text-xs text-muted-foreground">
        Your device does not support WebXR AR. Use the 3D viewer instead.
      </p>
    </div>
  );
}

// Create store outside component to avoid recreation on re-renders
const xrStore = createXRStore();

export default function ARViewer({ glbUrls, onExit }: ARViewerProps) {
  const [arActive, setArActive] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [placementMatrix, setPlacementMatrix] =
    useState<THREE.Matrix4 | null>(null);
  const [xrError, setXrError] = useState<string | null>(null);
  const latestHitMatrix = useRef<THREE.Matrix4 | null>(null);

  const handleEnterAR = async () => {
    try {
      setXrError(null);
      await xrStore.enterAR();
      setArActive(true);
      setPlaced(false);
      setPlacementMatrix(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to start AR session";
      if (msg.toLowerCase().includes("not supported")) {
        setXrError(
          "Your device does not support WebXR AR. Use the 3D viewer instead."
        );
      } else {
        setXrError(`AR session error: ${msg}`);
      }
    }
  };

  const handleExitAR = () => {
    setArActive(false);
    setPlaced(false);
    setPlacementMatrix(null);
    onExit?.();
  };

  const handleReplace = () => {
    setPlaced(false);
    setPlacementMatrix(null);
  };

  const handleHitMatrix = useCallback((m: THREE.Matrix4) => {
    latestHitMatrix.current = m.clone();
  }, []);

  // Tap on canvas to place model at latest hit-test position
  const handleCanvasClick = () => {
    if (!arActive || placed || !latestHitMatrix.current) return;
    setPlacementMatrix(latestHitMatrix.current.clone());
    setPlaced(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* 3D Canvas — hosts both the XR session and the preview */}
      <Canvas
        camera={{ position: [0, 1.2, 2], fov: 70 }}
        onClick={handleCanvasClick}
        gl={{ alpha: true, antialias: true }}
      >
        <XR store={xrStore}>
          <IfInSessionMode allow="immersive-ar">
            <ARScene
              glbUrls={glbUrls}
              placementMatrix={placementMatrix}
              placed={placed}
              onHitMatrix={handleHitMatrix}
            />
          </IfInSessionMode>

          {/* Non-AR preview */}
          <IfInSessionMode deny="immersive-ar">
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 4, 2]} intensity={1} />
            <PreviewScene glbUrls={glbUrls} />
          </IfInSessionMode>

          {/* Fallback when no XR session at all */}
          {!arActive && (
            <>
              <ambientLight intensity={0.6} />
              <directionalLight position={[2, 4, 2]} intensity={1} />
              <PreviewScene glbUrls={glbUrls} />
            </>
          )}
        </XR>
      </Canvas>

      {/* HUD overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <div className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
          {arActive ? "WebXR AR" : "3D Preview"}
        </div>
      </div>

      {/* Error message */}
      {xrError && (
        <div className="absolute inset-x-4 top-16 flex justify-center">
          <XRNotSupported />
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3">
        {!arActive && !xrError && (
          <p className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/70 backdrop-blur-sm">
            Tap &ldquo;Enter AR&rdquo; to try on in your space
          </p>
        )}

        {arActive && !placed && (
          <p className="rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/70 backdrop-blur-sm">
            Point at a flat surface, then tap to place
          </p>
        )}

        {arActive && placed && (
          <button
            onClick={handleReplace}
            className="rounded-full bg-muted/90 px-5 py-2 text-xs font-medium text-foreground backdrop-blur-sm transition hover:bg-muted active:scale-95"
            type="button"
          >
            Reposition
          </button>
        )}

        <div className="flex gap-3">
          {!arActive && (
            <button
              onClick={handleEnterAR}
              className="rounded-full bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-purple-700 active:scale-95"
              type="button"
            >
              Enter AR
            </button>
          )}

          <button
            onClick={handleExitAR}
            className="rounded-full bg-card/90 px-6 py-2.5 text-sm font-semibold text-foreground shadow-lg backdrop-blur-sm transition hover:bg-card active:scale-95"
            type="button"
          >
            Exit AR
          </button>
        </div>
      </div>
    </div>
  );
}
