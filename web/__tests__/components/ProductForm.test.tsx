import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Radix Select relies on pointer APIs jsdom lacks; swap in a native <select>
// so category/status can be driven deterministically with fireEvent.change.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" disabled hidden />
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

// The form fetches categories on mount; resolve empty so it keeps its fallback list.
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn().mockResolvedValue([]) },
}));

import { ProductForm } from "@/components/ProductForm";

function fillCore() {
  fireEvent.change(screen.getByPlaceholderText("e.g. Summer Linen Blouse"), {
    target: { value: "Linen Blouse" },
  });
  fireEvent.change(screen.getByPlaceholderText("0.00"), {
    target: { value: "50" },
  });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "TOPS" },
  });
}

describe("ProductForm size chart", () => {
  it("renders one measurement row per entered size", () => {
    render(<ProductForm mode="create" onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    // Grid is hidden until sizes are entered.
    expect(screen.queryByRole("group", { name: /size chart/i })).toBeNull();

    fireEvent.change(
      screen.getByPlaceholderText("XS, S, M, L, XL (comma-separated)"),
      { target: { value: "S, M" } },
    );

    const grid = screen.getByRole("group", { name: /size chart/i });
    // 2 sizes x 4 number cells = 8 spinbuttons.
    expect(within(grid).getAllByRole("spinbutton")).toHaveLength(8);
    expect(within(grid).getByLabelText("S chest cm")).toBeInTheDocument();
    expect(within(grid).getByLabelText("M chest cm")).toBeInTheDocument();
  });

  it("submits measurements with the entered size's parsed numbers", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm mode="create" onSubmit={onSubmit} />);

    fillCore();
    fireEvent.change(
      screen.getByPlaceholderText("XS, S, M, L, XL (comma-separated)"),
      { target: { value: "M" } },
    );
    fireEvent.change(screen.getByLabelText("M chest cm"), { target: { value: "95" } });
    fireEvent.change(screen.getByLabelText("M waist cm"), { target: { value: "80" } });

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = onSubmit.mock.calls[0][0];
    expect(data.measurements).toEqual([
      { sizeLabel: "M", chestCm: 95, waistCm: 80, hipsCm: null, lengthCm: null },
    ]);
  });

  it("drops a size whose cells are all blank from measurements", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductForm mode="create" onSubmit={onSubmit} />);

    fillCore();
    fireEvent.change(
      screen.getByPlaceholderText("XS, S, M, L, XL (comma-separated)"),
      { target: { value: "S, M" } },
    );
    // Only M gets a value; S stays blank.
    fireEvent.change(screen.getByLabelText("M hips cm"), { target: { value: "100" } });

    fireEvent.click(screen.getByRole("button", { name: /create product/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const data = onSubmit.mock.calls[0][0];
    expect(data.measurements).toHaveLength(1);
    expect(data.measurements[0].sizeLabel).toBe("M");
    expect(data.measurements.some((m: { sizeLabel: string }) => m.sizeLabel === "S")).toBe(false);
  });

  it("pre-fills the grid from initialData.measurements in edit mode", () => {
    render(
      <ProductForm
        mode="edit"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        initialData={{
          sizes: ["S", "M"],
          measurements: [
            { sizeLabel: "M", chestCm: 95, waistCm: 80, hipsCm: 100, lengthCm: 70 },
            { sizeLabel: "S", chestCm: null, waistCm: null, hipsCm: null, lengthCm: null },
          ],
        }}
      />,
    );

    const grid = screen.getByRole("group", { name: /size chart/i });
    expect(within(grid).getByLabelText("M chest cm")).toHaveValue(95);
    expect(within(grid).getByLabelText("M length cm")).toHaveValue(70);
    // Blank source row stays empty.
    expect(within(grid).getByLabelText("S chest cm")).toHaveValue(null);
  });
});
