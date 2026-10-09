import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  useSavedProductIds,
  toggleSavedProduct,
  clearSavedProducts,
  SAVED_PRODUCTS_STORAGE_KEY,
} from "@/lib/saved-products";

function Probe() {
  const saved = useSavedProductIds();
  return (
    <output data-testid="ids">
      {[...saved].sort((a, b) => a - b).join(",") || "none"}
    </output>
  );
}

describe("useSavedProductIds", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads the existing wishlist on first render", () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([3, 1]));
    render(<Probe />);
    expect(screen.getByTestId("ids")).toHaveTextContent("1,3");
  });

  it("renders an empty set when storage is empty", () => {
    render(<Probe />);
    expect(screen.getByTestId("ids")).toHaveTextContent("none");
  });

  it("re-renders when a product is saved and unsaved", () => {
    render(<Probe />);

    act(() => void toggleSavedProduct(42));
    expect(screen.getByTestId("ids")).toHaveTextContent("42");

    act(() => void toggleSavedProduct(42));
    expect(screen.getByTestId("ids")).toHaveTextContent("none");
  });

  it("picks up a change made in another tab", () => {
    render(<Probe />);

    act(() => {
      localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([7]));
      window.dispatchEvent(new StorageEvent("storage"));
    });

    expect(screen.getByTestId("ids")).toHaveTextContent("7");
  });

  it("re-renders on clear", () => {
    act(() => void toggleSavedProduct(5));
    render(<Probe />);
    expect(screen.getByTestId("ids")).toHaveTextContent("5");

    act(() => clearSavedProducts());
    expect(screen.getByTestId("ids")).toHaveTextContent("none");
  });
});
