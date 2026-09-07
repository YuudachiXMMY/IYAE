import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button capsule variants", () => {
  it("renders brand-pill + pill size with editorial classes", () => {
    render(
      <Button variant="brand-pill" size="pill">
        GO
      </Button>
    );

    const btn = screen.getByRole("button", { name: "GO" });
    const cls = btn.className;
    expect(cls).toContain("bg-foreground");
    expect(cls).toContain("rounded-button");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("h-12");
  });

  it("renders outline-pill variant", () => {
    render(
      <Button variant="outline-pill" size="pill">
        MORE
      </Button>
    );

    const cls = screen.getByRole("button", { name: "MORE" }).className;
    expect(cls).toContain("border-border");
    expect(cls).toContain("rounded-button");
    expect(cls).toContain("uppercase");
  });
});
