import { render, screen, fireEvent } from "@testing-library/react";
import { SizeSelector } from "@/components/SizeSelector";
import { describe, it, expect, vi } from "vitest";

describe("SizeSelector", () => {
  it("renders size buttons for each size", () => {
    render(
      <SizeSelector sizes={["S", "M", "L"]} selectedSize={null} onSelect={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "S" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "L" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("applies selected styles to selected size", () => {
    render(
      <SizeSelector sizes={["S", "M", "L"]} selectedSize="M" onSelect={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "L" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect when button clicked", () => {
    const onSelect = vi.fn();
    render(
      <SizeSelector sizes={["S", "M", "L"]} selectedSize={null} onSelect={onSelect} />
    );

    fireEvent.click(screen.getByRole("button", { name: "L" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("L");
  });

  it("returns null for empty sizes", () => {
    const { container } = render(
      <SizeSelector sizes={[]} selectedSize={null} onSelect={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("disables all buttons when disabled prop is true", () => {
    render(
      <SizeSelector sizes={["S", "M", "L"]} selectedSize={null} onSelect={vi.fn()} disabled={true} />
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
