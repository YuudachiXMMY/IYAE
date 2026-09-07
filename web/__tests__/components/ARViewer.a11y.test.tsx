import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// React Three Fiber / drei / @react-three/xr are WebGL-bound and unusable under jsdom.
// Mock them so ARViewer renders its DOM overlay — the surface under accessibility test —
// without mounting the 3D scene graph. Canvas renders null, so its R3F children (the XR
// scene) never mount and no useGLTF/hit-test runs. enterAR rejects "not supported" so the
// unsupported-alert path is exercised on demand.
vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}));
vi.mock("@react-three/drei", () => ({
  useGLTF: () => ({ scene: {} }),
}));
vi.mock("@react-three/xr", () => ({
  XR: () => null,
  createXRStore: () => ({
    enterAR: () => Promise.reject(new Error("not supported")),
  }),
  useXRHitTest: () => {},
  IfInSessionMode: () => null,
  XROrigin: () => null,
}));

import ARViewer from "@/components/ARViewer";

describe("ARViewer accessibility", () => {
  it("labels the overlay as a modal dialog", () => {
    render(<ARViewer glbUrls={[]} />);
    const dialog = screen.getByRole("dialog", {
      name: /augmented reality try-on/i,
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus into the overlay on mount (trap engaged)", () => {
    render(<ARViewer glbUrls={[]} />);
    expect(screen.getByRole("button", { name: /enter ar/i })).toHaveFocus();
  });

  it("cycles Tab / Shift+Tab within the overlay controls", () => {
    render(<ARViewer glbUrls={[]} />);
    const enter = screen.getByRole("button", { name: /enter ar/i });
    const exit = screen.getByRole("button", { name: /exit ar/i });

    // Tab from the last control wraps back to the first.
    exit.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(enter).toHaveFocus();

    // Shift+Tab from the first control wraps to the last.
    enter.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(exit).toHaveFocus();
  });

  it("exits (calls onExit) on Escape", () => {
    const onExit = vi.fn();
    render(<ARViewer glbUrls={[]} onExit={onExit} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("announces an alert when WebXR is unsupported", async () => {
    render(<ARViewer glbUrls={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /enter ar/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
