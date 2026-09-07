import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProductCard } from "@/components/design-system/ProductCard";

describe("ProductCard", () => {
  it("renders name, price, and a Save button", () => {
    render(
      <ProductCard
        name="Draped Wool Coat"
        price="$420"
        href="/products/1"
      />
    );

    expect(screen.getByText("Draped Wool Coat")).toBeInTheDocument();
    expect(screen.getByText("$420")).toBeInTheDocument();
    const saveBtn = screen.getByRole("button", { name: "Save" });
    expect(saveBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("renders AbstractForm fallback when no imageUrl is provided", () => {
    const { container } = render(
      <ProductCard name="No Image Piece" price="$99" href="/products/2" />
    );

    // AbstractForm renders an aria-hidden decorative div (no next/image).
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});
