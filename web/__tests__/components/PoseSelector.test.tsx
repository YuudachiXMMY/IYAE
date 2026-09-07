import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PoseSelector } from "@/components/PoseSelector";
import { POSE_CATEGORIES, POSE_PRESETS } from "@/lib/pose-config";

// Flattened pose order the component navigates (categories in order, poses within each).
const flatPoses = POSE_CATEGORIES.flatMap((cat) =>
  POSE_PRESETS.filter((p) => p.category === cat.id)
);

describe("PoseSelector (APG toolbar: roving-tabindex + arrow keys)", () => {
  it("keeps role=toolbar and aria-pressed on the active pose", () => {
    render(<PoseSelector activePoseId={flatPoses[0].id} onPoseSelect={vi.fn()} />);
    expect(
      screen.getByRole("toolbar", { name: /pose presets/i })
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("puts exactly one button (the active pose) in the tab order", () => {
    render(<PoseSelector activePoseId={flatPoses[0].id} onPoseSelect={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("tabindex", "0");
    buttons.slice(1).forEach((b) => expect(b).toHaveAttribute("tabindex", "-1"));
  });

  it("ArrowRight moves focus AND selection to the next pose", () => {
    const onPoseSelect = vi.fn();
    render(<PoseSelector activePoseId={flatPoses[0].id} onPoseSelect={onPoseSelect} />);
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowRight" });
    expect(onPoseSelect).toHaveBeenCalledWith(flatPoses[1].id);
    expect(buttons[1]).toHaveFocus();
  });

  it("ArrowLeft clamps at the first pose (no wraparound)", () => {
    const onPoseSelect = vi.fn();
    render(<PoseSelector activePoseId={flatPoses[0].id} onPoseSelect={onPoseSelect} />);
    const buttons = screen.getAllByRole("button");
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "ArrowLeft" });
    expect(onPoseSelect).not.toHaveBeenCalled();
    expect(buttons[0]).toHaveFocus();
  });

  it("End jumps to the last pose; Home returns to the first", () => {
    const onPoseSelect = vi.fn();
    render(<PoseSelector activePoseId={flatPoses[0].id} onPoseSelect={onPoseSelect} />);
    const buttons = screen.getAllByRole("button");
    const last = buttons.length - 1;
    buttons[0].focus();
    fireEvent.keyDown(buttons[0], { key: "End" });
    expect(onPoseSelect).toHaveBeenLastCalledWith(flatPoses[last].id);
    expect(buttons[last]).toHaveFocus();
    fireEvent.keyDown(buttons[last], { key: "Home" });
    expect(onPoseSelect).toHaveBeenLastCalledWith(flatPoses[0].id);
    expect(buttons[0]).toHaveFocus();
  });
});
