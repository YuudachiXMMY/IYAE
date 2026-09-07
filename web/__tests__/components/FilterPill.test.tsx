import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FilterPill } from "@/components/design-system/FilterPill";

describe("FilterPill", () => {
  it("applies active styles and aria-pressed=true when active", () => {
    render(
      <FilterPill active onClick={vi.fn()}>
        New In
      </FilterPill>
    );

    const btn = screen.getByRole("button", { name: "New In" });
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.className).toContain("bg-foreground");
    expect(btn.className).toContain("text-background");
  });

  it("applies inactive styles and aria-pressed=false when inactive", () => {
    render(
      <FilterPill active={false} onClick={vi.fn()}>
        For You
      </FilterPill>
    );

    const btn = screen.getByRole("button", { name: "For You" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn.className).toContain("border-border");
    expect(btn.className).toContain("text-muted-foreground");
  });

  it("fires onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <FilterPill active={false} onClick={onClick}>
        Clothing
      </FilterPill>
    );

    fireEvent.click(screen.getByRole("button", { name: "Clothing" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
