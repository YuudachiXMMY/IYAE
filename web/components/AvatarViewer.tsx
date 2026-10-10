"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  useGLTF,
  Bounds,
  useProgress,
  useEnvironment,
  Html,
  ContactShadows,
} from "@react-three/drei";
import {
  Skeleton,
  Matrix4,
  Box3,
  Vector3,
  ACESFilmicToneMapping,
  type Bone,
  type Mesh,
  type Object3D,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { SkinnedMesh } from "three";
import SkeletonContext, { useSkeletonContext } from "./SkeletonContext";
import {
  applyAntiPenetrationToScene,
  applyLayeredAntiPenetrationToScene,
  applyGarmentNormalMapToScene,
  fabricizeScene,
} from "./FittingHelper";
import { usePoseAnimation } from "@/lib/hooks/usePoseAnimation";
import { PoseSelector } from "./PoseSelector";
import { POSE_PRESETS } from "@/lib/pose-config";
import { useTrackEvent } from "@/lib/hooks/useTrackEvent";

const DEFAULT_POSE_ID = POSE_PRESETS.find((p) => p.isDefault)?.id ?? "a-pose";

const ENVIRONMENT_PRESET = "studio";

// Warm drei's environment cache at module scope. <Environment> otherwise starts
// its HDR load during EnvironmentCube's render, and that load synchronously
// writes drei's global useProgress store — which `Loader`/`LoadStatus` below
// subscribe to. React then reports "Cannot update a component (Loader) while
// rendering a different component (EnvironmentCube)". Preloading makes the
// lookup a cache hit, so nothing is written mid-render.
useEnvironment.preload({ preset: ENVIRONMENT_PRESET });

/**
 * Screen-reader-only live region announcing 3D load progress. Lives in normal DOM
 * (a sibling of the Canvas, not inside drei's <Html>) so assistive tech reliably
 * announces it. Reads drei's global progress store.
 */
function LoadStatus() {
  const { active, progress } = useProgress();
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {active ? `Loading 3D preview, ${Math.round(progress)} percent` : "3D preview ready"}
    </span>
  );
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
      </div>
    </Html>
  );
}

/**
 * Suspense fallback that shows an instant 2D product still while the rigged
 * avatar/garment GLBs stream in. Renders inside the R3F <Canvas>, so it MUST be
 * a drei <Html> (a raw <img> at this position breaks reconciliation). Falls back
 * to the progress spinner when no preview image is available.
 */
function PreviewFallback({ previewImageUrl }: { previewImageUrl?: string }) {
  if (!previewImageUrl) return <Loader />;
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewImageUrl}
          className="max-h-[60vh] object-contain opacity-80"
          alt=""
        />
        <p className="text-xs text-muted-foreground">Loading your fit...</p>
      </div>
    </Html>
  );
}

interface GarmentModelProps {
  url: string;
  slot?: string;
}

function GarmentModel({ url, slot }: GarmentModelProps) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  useEffect(() => {
    fabricizeScene(cloned);
    applyGarmentNormalMapToScene(cloned, slot);
  }, [cloned, slot]);
  return <primitive object={cloned} />;
}

interface AvatarModelProps {
  url: string;
  poseId?: string | null;
  children?: React.ReactNode;
}

function AvatarModel({ url, poseId = null, children }: AvatarModelProps) {
  const { scene } = useGLTF(url);
  const sceneRef = useRef<Object3D>(null);

  const { clonedScene, boneMap } = useMemo(() => {
    const clone = cloneSkeleton(scene);
    const map = new Map<string, Bone>();
    clone.traverse((child) => {
      if ((child as SkinnedMesh).isSkinnedMesh) {
        const mesh = child as SkinnedMesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        for (const bone of mesh.skeleton.bones) {
          map.set(bone.name, bone);
        }
      } else if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return { clonedScene: clone, boneMap: map };
  }, [scene]);

  useEffect(() => {
    sceneRef.current = clonedScene;
  }, [clonedScene]);

  usePoseAnimation(sceneRef, poseId);

  return (
    <SkeletonContext.Provider value={boneMap}>
      <primitive object={clonedScene} />
      {children}
    </SkeletonContext.Provider>
  );
}

interface BoundGarmentModelProps {
  url: string;
  slot?: string;
  onError: () => void;
}

function BoundGarmentModel({ url, slot, onError }: BoundGarmentModelProps) {
  const masterBones = useSkeletonContext();
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => cloneSkeleton(scene), [scene]);

  useEffect(() => {
    try {
      clonedScene.traverse((child) => {
        if ((child as SkinnedMesh).isSkinnedMesh) {
          const mesh = child as SkinnedMesh;
          const originalBones = mesh.skeleton.bones;
          const originalInverses = mesh.skeleton.boneInverses;

          const reboundBones = originalBones.map((bone) => {
            if (masterBones && masterBones.has(bone.name)) {
              return masterBones.get(bone.name) as Bone;
            }
            return bone;
          });

          const boneInverses = originalInverses.map(
            (inv) => inv.clone() as Matrix4
          );

          const newSkeleton = new Skeleton(reboundBones, boneInverses);
          mesh.bind(newSkeleton);
        }
      });

      if (slot) {
        applyLayeredAntiPenetrationToScene(clonedScene, slot);
      } else {
        applyAntiPenetrationToScene(clonedScene);
      }

      fabricizeScene(clonedScene);
      applyGarmentNormalMapToScene(clonedScene, slot);

      /** Scale guard: detect garments with wildly incorrect scale */
      const box = new Box3().setFromObject(clonedScene);
      if (!box.isEmpty()) {
        const size = new Vector3();
        box.getSize(size);
        if (size.y > 8.5 || size.y < 0.01) {
          console.warn(
            `[AvatarViewer] Garment scale out of range: height=${size.y.toFixed(3)}m, triggering fallback`
          );
          onError();
          return;
        }
      }
    } catch {
      onError();
    }
  }, [clonedScene, masterBones, slot, onError]);

  if (!clonedScene) {
    onError();
    return null;
  }

  return <primitive object={clonedScene} />;
}

interface AvatarViewerProps {
  avatarUrl?: string;
  garmentUrls?: string[];
  glbUrls?: string[];
  /** Rigged garment GLBs with full skeleton data. When provided, these take
   *  priority over garmentUrls/glbUrls and receive anti-penetration treatment. */
  riggedGarmentUrls?: string[];
  /** Slot names corresponding 1:1 to riggedGarmentUrls (e.g., ["top", "bottom"]) */
  riggedGarmentSlots?: string[];
  /** Optional 2D product still shown as the Suspense fallback while GLBs stream in. */
  previewImageUrl?: string;
  /** Optional context for the fire-once TRYON_STARTED analytics event. When the
   *  garment content is ready, this viewer emits a first-party try-on session event
   *  (see the Phase 0 drape-realism funnel). Absent context still emits with surface "unknown". */
  trackingContext?: { productId?: number; surface?: string };
}

export default function AvatarViewer({
  avatarUrl,
  garmentUrls,
  glbUrls,
  riggedGarmentUrls,
  riggedGarmentSlots,
  previewImageUrl,
  trackingContext,
}: AvatarViewerProps) {
  const hasRigged = Boolean(riggedGarmentUrls?.length);

  const [riggedFailed, setRiggedFailed] = useState(false);
  const [activePoseId, setActivePoseId] = useState<string | null>(DEFAULT_POSE_ID);

  // garmentUrls = non-rigged items only; glbUrls = all items (fallback)
  const staticGarments = garmentUrls ?? glbUrls ?? [];
  const allGarments = glbUrls ?? garmentUrls ?? [];
  const renderRigged = hasRigged && !riggedFailed;

  const hasContent =
    Boolean(avatarUrl) || staticGarments.length > 0 || hasRigged;

  // Phase 0 drape-realism funnel: emit a fire-once TRYON_STARTED event when the
  // garment content is present. Ref-guarded so a StrictMode double-mount (or re-render)
  // only reports one session per mount. Mirrors the VIEW ref-guard on the PDP.
  const track = useTrackEvent();
  const trackedRef = useRef(false);
  useEffect(() => {
    if (!hasContent || trackedRef.current) return;
    trackedRef.current = true;
    track({
      type: "TRYON_STARTED",
      productId: trackingContext?.productId,
      metadata: JSON.stringify({ surface: trackingContext?.surface ?? "unknown" }),
    });
  }, [hasContent, track, trackingContext]);

  if (!hasContent) return null;

  // Render rigged items (BoundGarmentModel) + non-rigged items (GarmentModel)
  // together. On rigged failure, fall back to all items as static.
  const renderGarments = (insideAvatar: boolean) => {
    if (renderRigged) {
      return (
        <>
          {(riggedGarmentUrls ?? []).map((url, i) =>
            insideAvatar ? (
              <BoundGarmentModel
                key={`rigged-${url}`}
                url={url}
                slot={riggedGarmentSlots?.[i]}
                onError={() => setRiggedFailed(true)}
              />
            ) : (
              <GarmentModel key={`rigged-${url}`} url={url} slot={riggedGarmentSlots?.[i]} />
            )
          )}
          {staticGarments.map((url) => (
            <GarmentModel key={`static-${url}`} url={url} />
          ))}
        </>
      );
    }
    return (
      <>
        {allGarments.map((url) => (
          <GarmentModel key={`fallback-${url}`} url={url} />
        ))}
      </>
    );
  };

  return (
    <div
      className="relative w-full h-full"
      role="img"
      aria-label="Interactive 3D preview of your outfit on the avatar. Drag to rotate, scroll to zoom."
      tabIndex={0}
    >
      <LoadStatus />
      <Canvas
        shadows
        camera={{ position: [0, 1, 3], fov: 50 }}
        gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight castShadow position={[4, 6, 4]} intensity={1.2} />
        <directionalLight position={[-4, 2, -4]} intensity={0.4} />
        <Suspense fallback={<PreviewFallback previewImageUrl={previewImageUrl} />}>
          <Bounds fit clip observe margin={1.2}>
            {avatarUrl ? (
              <AvatarModel url={avatarUrl} poseId={activePoseId}>
                {renderGarments(true)}
              </AvatarModel>
            ) : (
              renderGarments(false)
            )}
          </Bounds>
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.35}
            scale={6}
            blur={2.4}
            far={4}
            resolution={512}
            color="#000000"
          />
          <Environment preset={ENVIRONMENT_PRESET} environmentIntensity={0.6} />
        </Suspense>
        <OrbitControls makeDefault enablePan enableZoom enableRotate />
      </Canvas>
      {hasRigged && riggedFailed && (
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-card/80 px-2 py-0.5 rounded">
          Static preview
        </p>
      )}
      {avatarUrl && renderRigged && (
        <PoseSelector
          activePoseId={activePoseId}
          onPoseSelect={setActivePoseId}
        />
      )}
    </div>
  );
}
