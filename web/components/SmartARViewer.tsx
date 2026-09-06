"use client";
// SmartARViewer — device-adaptive AR router
//
// Routing logic:
//   WebXR (Android Chrome 79+ / Meta Quest) → ARViewer (immersive-ar)
//   iOS Safari                               → ModelViewer (AR Quick Look, .usdz)
//   Android without WebXR                   → ModelViewer (Scene Viewer, .glb)
//   Desktop                                  → AvatarViewer (3D only, orbit controls)

import dynamic from "next/dynamic";
import { useARSupport } from "@/lib/hooks/useARSupport";
import { Skeleton } from "@/components/ui/skeleton";

// All 3D/AR components must be dynamically imported with ssr: false to
// prevent server-side rendering of WebGL / web-component code.
const ARViewer = dynamic(() => import("./ARViewer"), { ssr: false });
const ModelViewerComponent = dynamic(() => import("./ModelViewer"), {
  ssr: false,
});
const AvatarViewer = dynamic(() => import("./AvatarViewer"), { ssr: false });

interface SmartARViewerProps {
  glbUrls?: string[];
  usdzUrl?: string;
  glbAssetUrl?: string;
  usdzAssetUrl?: string;
  riggedGlbUrl?: string;
  riggedUsdzUrl?: string;
  /** 2D product still shown while the desktop 3D viewer streams GLBs in. */
  previewImageUrl?: string;
}

export function SmartARViewer({
  glbUrls,
  usdzUrl,
  glbAssetUrl,
  usdzAssetUrl,
  riggedGlbUrl,
  riggedUsdzUrl,
  previewImageUrl,
}: SmartARViewerProps) {
  const { webxr, arQuickLook, sceneViewer, loading } = useARSupport();

  // Rigged assets take priority over worker-generated, which take priority over fallback
  const effectiveGlbUrl = riggedGlbUrl || glbAssetUrl || glbUrls?.[0];
  const effectiveUsdzUrl = riggedUsdzUrl || usdzAssetUrl || usdzUrl;
  const effectiveGlbUrls = riggedGlbUrl ? [riggedGlbUrl] : (glbUrls || []);

  if (loading) {
    return <Skeleton className="h-[500px] w-full rounded-card" />;
  }

  // WebXR — Android Chrome 79+ / Meta Quest Browser
  if (webxr) {
    return <ARViewer glbUrls={effectiveGlbUrls} />;
  }

  // iOS Safari — AR Quick Look via model-viewer (requires .usdz)
  if (arQuickLook && effectiveUsdzUrl) {
    return (
      <ModelViewerComponent
        glbUrl={effectiveGlbUrl ?? ""}
        usdzUrl={effectiveUsdzUrl}
        className="h-[500px] w-full"
      />
    );
  }

  // Android without WebXR — Scene Viewer via model-viewer (.glb)
  if (sceneViewer && effectiveGlbUrl) {
    return (
      <ModelViewerComponent
        glbUrl={effectiveGlbUrl}
        className="h-[500px] w-full"
      />
    );
  }

  // Desktop / unsupported — 3D orbit viewer only
  return (
    <AvatarViewer
      glbUrls={effectiveGlbUrls}
      riggedGarmentUrls={riggedGlbUrl ? [riggedGlbUrl] : undefined}
      previewImageUrl={previewImageUrl}
    />
  );
}
