import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Mock } from "vitest";

// Partial mock: everything stays real (the seeding, the migrations, the storage
// key), but the two storage entry points become observable. What this file pins
// is the *call contract* — the four arguments the loader is given and the key it
// is saved under — because `app/community/page.tsx` has to make exactly the same
// calls, and a silent divergence would have the two surfaces seeding different
// feeds into one storage entry.
vi.mock("@/lib/community-feed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/community-feed")>();
  return {
    ...actual,
    loadCommunityState: vi.fn(actual.loadCommunityState),
    saveCommunityState: vi.fn(actual.saveCommunityState),
  };
});

import { loadCommunityState, saveCommunityState } from "@/lib/community-feed";
import { useCommunityState } from "@/lib/hooks/useCommunityState";

const loadSpy = loadCommunityState as Mock;
const saveSpy = saveCommunityState as Mock;

describe("useCommunityState", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("seeds from the viewer, falling back to empty names and Everyday", () => {
    renderHook(() =>
      useCommunityState({ id: 7, name: null, username: null, styleAesthetics: null }),
    );
    expect(loadSpy).toHaveBeenCalledWith("7", "", "", "Everyday");
  });

  it("passes the display name, username and first aesthetic through", () => {
    renderHook(() =>
      useCommunityState({
        id: 7,
        name: "Ada",
        username: "ada",
        styleAesthetics: ["Minimalist", "Street"],
      }),
    );
    expect(loadSpy).toHaveBeenCalledWith("7", "Ada", "ada", "Minimalist");
  });

  it("has the feed on the first render, with no load from an effect", () => {
    const { result } = renderHook(() =>
      useCommunityState({ id: 7, name: "Ada", username: "ada", styleAesthetics: [] }),
    );
    expect(result.current.state?.posts.length).toBeGreaterThan(0);
  });

  it("persists under the viewer's key when the state changes", () => {
    const { result } = renderHook(() =>
      useCommunityState({ id: 7, name: "Ada", username: "ada", styleAesthetics: [] }),
    );
    saveSpy.mockClear();

    act(() => result.current.handleToggleFollow("someone-else"));

    const [userId, saved] = saveSpy.mock.calls.at(-1) ?? [];
    expect(userId).toBe("7");
    expect(saved.followedUsernames).toContain("someone-else");
  });

  it("holds no state and writes nothing while signed out", () => {
    const { result } = renderHook(() => useCommunityState(null));
    expect(result.current.state).toBeNull();
    expect(loadSpy).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  // Reloading is keyed on the values the loader reads, not on the user object's
  // identity — AuthContext's refreshUser hands back a new object every time.
  it("reloads when the viewer changes but not when the object identity does", () => {
    const ada = { id: 7, name: "Ada", username: "ada", styleAesthetics: ["Minimalist"] };
    const { rerender } = renderHook(
      ({ user }: { user: Parameters<typeof useCommunityState>[0] }) =>
        useCommunityState(user),
      { initialProps: { user: ada } },
    );
    expect(loadSpy).toHaveBeenCalledTimes(1);

    rerender({ user: { ...ada } });
    expect(loadSpy).toHaveBeenCalledTimes(1);

    rerender({ user: { ...ada, id: 8 } });
    expect(loadSpy).toHaveBeenLastCalledWith("8", "Ada", "ada", "Minimalist");
  });
});
