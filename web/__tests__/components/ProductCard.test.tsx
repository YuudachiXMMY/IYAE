import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ProductCard } from "@/components/design-system/ProductCard";

describe("ProductCard", () => {
  it("renders name and price", () => {
    render(
      <ProductCard name="Draped Wool Coat" price="$420" href="/products/1" />
    );

    expect(screen.getByText("Draped Wool Coat")).toBeInTheDocument();
    expect(screen.getByText("$420")).toBeInTheDocument();
  });

  it("renders AbstractForm fallback when no imageUrl is provided", () => {
    const { container } = render(
      <ProductCard name="No Image Piece" price="$99" href="/products/2" />
    );

    // AbstractForm renders an aria-hidden decorative div (no next/image).
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  describe("the Save control", () => {
    it("is a button that reports its pressed state when onToggleSave is given", async () => {
      const onToggleSave = vi.fn();
      render(
        <ProductCard
          name="Coat"
          price="$420"
          href="/products/1"
          onToggleSave={onToggleSave}
        />
      );

      const saveBtn = screen.getByRole("button", { name: "Save" });
      expect(saveBtn).toHaveAttribute("aria-pressed", "false");

      await userEvent.click(saveBtn);
      expect(onToggleSave).toHaveBeenCalledTimes(1);
    });

    it("reflects saved=true as pressed", () => {
      render(
        <ProductCard
          name="Coat"
          price="$420"
          href="/products/1"
          saved
          onToggleSave={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    // Regression: the shop grid rendered a heart with no handler, so every
    // click was silently swallowed by `onToggleSave?.()`.
    it("renders no clickable button when there is no handler", () => {
      render(<ProductCard name="Coat" price="$420" href="/products/1" />);

      expect(
        screen.queryByRole("button", { name: "Save" })
      ).not.toBeInTheDocument();
    });

    it("shows a non-interactive indicator for a saved card with no handler", () => {
      render(<ProductCard name="Coat" price="$420" href="/products/1" saved />);

      expect(
        screen.queryByRole("button", { name: "Save" })
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Saved")).toBeInTheDocument();
    });
  });
});
