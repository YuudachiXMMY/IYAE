import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendedSizeHint } from "@/components/RecommendedSizeHint";

describe("RecommendedSizeHint", () => {
  it("renders the recommended size for a MEASUREMENT_CHART basis", () => {
    render(<RecommendedSizeHint recommendedSize="M" basis="MEASUREMENT_CHART" />);
    expect(screen.getByText(/your recommended size/i)).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("does not show the saved-sizes caption for a MEASUREMENT_CHART basis", () => {
    render(<RecommendedSizeHint recommendedSize="M" basis="MEASUREMENT_CHART" />);
    expect(screen.queryByText(/based on your saved sizes/i)).toBeNull();
  });

  it("shows the saved-sizes caption for a SELF_REPORTED basis", () => {
    render(<RecommendedSizeHint recommendedSize="L" basis="SELF_REPORTED" />);
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText(/based on your saved sizes/i)).toBeInTheDocument();
  });

  it("renders nothing when basis is NONE", () => {
    const { container } = render(
      <RecommendedSizeHint recommendedSize={null} basis="NONE" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when recommendedSize is null even for a chart basis", () => {
    const { container } = render(
      <RecommendedSizeHint recommendedSize={null} basis="MEASUREMENT_CHART" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
