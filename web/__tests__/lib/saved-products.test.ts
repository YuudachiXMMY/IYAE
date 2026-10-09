import { describe, it, expect, beforeEach } from "vitest";
import {
  getSavedProductIds,
  isProductSaved,
  toggleSavedProduct,
  clearSavedProducts,
  SAVED_PRODUCTS_STORAGE_KEY,
} from "@/lib/saved-products";

describe("saved-products", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    expect(getSavedProductIds()).toEqual([]);
    expect(isProductSaved(1)).toBe(false);
  });

  it("toggleSavedProduct saves, then unsaves, returning the new state", () => {
    expect(toggleSavedProduct(7)).toBe(true);
    expect(isProductSaved(7)).toBe(true);
    expect(getSavedProductIds()).toEqual([7]);

    expect(toggleSavedProduct(7)).toBe(false);
    expect(isProductSaved(7)).toBe(false);
    expect(getSavedProductIds()).toEqual([]);
  });

  it("keeps the most recently saved product first", () => {
    toggleSavedProduct(1);
    toggleSavedProduct(2);
    toggleSavedProduct(3);
    expect(getSavedProductIds()).toEqual([3, 2, 1]);
  });

  it("persists across reads and never duplicates an id", () => {
    toggleSavedProduct(4);
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([4, 4, 4]));
    expect(getSavedProductIds()).toEqual([4]);
    expect(toggleSavedProduct(4)).toBe(false);
    expect(getSavedProductIds()).toEqual([]);
  });

  it("survives corrupt storage without throwing", () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, "{not json");
    expect(getSavedProductIds()).toEqual([]);
    expect(toggleSavedProduct(9)).toBe(true);
    expect(getSavedProductIds()).toEqual([9]);
  });

  it("ignores non-numeric entries written by other versions", () => {
    localStorage.setItem(
      SAVED_PRODUCTS_STORAGE_KEY,
      JSON.stringify([1, "2", null, 3.5, 4]),
    );
    expect(getSavedProductIds()).toEqual([1, 4]);
  });

  it("clearSavedProducts empties the store", () => {
    toggleSavedProduct(1);
    toggleSavedProduct(2);
    clearSavedProducts();
    expect(getSavedProductIds()).toEqual([]);
  });

  it("notifies subscribers on write and on clear", () => {
    const seen: string[] = [];
    const handler = () => seen.push("changed");
    window.addEventListener("clossette:saved-products-changed", handler);

    toggleSavedProduct(1);
    toggleSavedProduct(1);
    clearSavedProducts();

    window.removeEventListener("clossette:saved-products-changed", handler);
    expect(seen).toHaveLength(3);
  });
});
