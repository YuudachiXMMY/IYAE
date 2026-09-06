"use client";
// @google/model-viewer integration for iOS AR Quick Look and Android Scene Viewer
// Loaded dynamically to avoid SSR issues with web components.

import { useEffect, useRef } from "react";

interface ModelViewerProps {
  glbUrl: string;
  usdzUrl?: string;
  alt?: string;
  className?: string;
}

export default function ModelViewer({
  glbUrl,
  usdzUrl,
  alt,
  className,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load the model-viewer custom element once
    if (!customElements.get("model-viewer")) {
      const script = document.createElement("script");
      script.type = "module";
      script.src =
        "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div ref={containerRef} className={className ?? "h-[500px] w-full"}>
      {/* @ts-expect-error — model-viewer is a custom web component not in JSX types */}
      <model-viewer
        src={glbUrl}
        ios-src={usdzUrl}
        alt={alt ?? "Interactive 3D model of the garment. Use the on-viewer controls to rotate and view in AR."}
        auto-rotate
        camera-controls
        ar
        ar-modes="webxr scene-viewer quick-look"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
