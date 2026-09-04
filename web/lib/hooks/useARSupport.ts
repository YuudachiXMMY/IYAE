"use client";
import { useState, useEffect } from "react";

interface ARSupport {
  webxr: boolean;
  arQuickLook: boolean;
  sceneViewer: boolean;
  loading: boolean;
}

export function useARSupport(): ARSupport {
  const [support, setSupport] = useState<ARSupport>({
    webxr: false,
    arQuickLook: false,
    sceneViewer: false,
    loading: true,
  });

  useEffect(() => {
    async function detect() {
      let webxr = false;
      let arQuickLook = false;
      let sceneViewer = false;

      // WebXR detection
      if (navigator.xr) {
        try {
          webxr = await navigator.xr.isSessionSupported("immersive-ar");
        } catch {
          webxr = false;
        }
      }

      // AR Quick Look (iOS Safari)
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (iOS) {
        arQuickLook = true;
      }

      // Scene Viewer (Android)
      const android = /android/i.test(navigator.userAgent);
      if (android && !webxr) {
        sceneViewer = true;
      }

      setSupport({ webxr, arQuickLook, sceneViewer, loading: false });
    }

    void detect();
  }, []);

  return support;
}
