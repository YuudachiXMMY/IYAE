import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The consent checkbox had no test anywhere in the suite, and inspection showed it gated
// nothing: `agreed` was local `useState` inside StepBasics whose only readers were its own
// declaration and the `checked` prop. It never reached `onChange`, and `RegisterPage.canAdvance()`
// for step 0 checked only email/password/role — so an account could be created, including the
// body measurements the wizard collects later, with the box never ticked.
//
// These cases pin the two halves that together make the box mean something: it must gate
// CONTINUE, and clicking the Terms/Privacy links must not tick it (a <label> forwards every
// click within it to its control, so links inside the label consented on the user's behalf to
// the document they were in the act of going to read).

const { mockPush, mockRegister } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRegister: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

vi.mock("@/lib/hooks/useRedirectIfAuthenticated", () => ({
  useRedirectIfAuthenticated: () => ({ isAuthenticated: false, loading: false }),
}));

vi.mock("@/lib/auth-config", () => ({
  resolvePostRegisterRedirect: vi.fn(async () => "/dashboard"),
}));

// The page mounts SiteHeader, which reads CartContext. The header is not the subject here.
vi.mock("@/components/design-system/SiteHeader", () => ({
  SiteHeader: () => null,
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

import RegisterPage from "@/app/register/page";

function continueButton() {
  return screen.getByRole("button", { name: /^CONTINUE$/i });
}

/** Fills the three fields step 0 required before consent was part of the gate. */
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/email address/i), "new@example.com");
  await user.type(screen.getByLabelText(/create password/i), "password123");
}

describe("registration consent gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts unchecked", () => {
    render(<RegisterPage />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("keeps CONTINUE disabled while the box is unchecked, even with every other field filled", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillRequiredFields(user);

    // Role defaults to BUYER, so email + password + role are all satisfied here. Before the
    // fix this is the exact state in which CONTINUE was enabled.
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(continueButton()).toBeDisabled();
  });

  it("enables CONTINUE once the box is checked", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toBeChecked();
    await waitFor(() => expect(continueButton()).toBeEnabled());
  });

  it("ticks when the consent prose is clicked", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.click(screen.getByText(/i agree to/i));

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("does not tick when the Terms or Privacy link is clicked", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.click(screen.getByRole("link", { name: /^terms$/i }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();

    await user.click(screen.getByRole("link", { name: /privacy policy/i }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("exposes both documents to the checkbox as a description", () => {
    render(<RegisterPage />);
    const describedBy = screen.getByRole("checkbox").getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy!);
    expect(description?.textContent).toMatch(/terms/i);
    expect(description?.textContent).toMatch(/privacy policy/i);
  });

  it("opens the legal documents without handing them a window.opener reference", () => {
    render(<RegisterPage />);
    for (const name of [/^terms$/i, /privacy policy/i]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel") ?? "").toContain("noopener");
    }
  });
});
