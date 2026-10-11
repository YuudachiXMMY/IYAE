"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { api, AUTH_TOKEN_KEY, type RegisterRequest, type UpdateProfileRequest } from "./api";
import { isVerificationPending } from "./auth-config";
import { clearSavedProducts, resetSavedProductsSync } from "./saved-products";
import { clearDemoCartItems } from "./demo-cart";

interface User {
  id: number;
  email: string;
  name: string | null;
  role: "BUYER" | "DESIGNER" | "ADMIN";
  emailVerified: boolean;
  username?: string | null;
  ageRange?: string | null;
  genderIdentity?: string | null;
  profileVisibility?: string;
  bodyProfileVisibility?: string;
  styleAesthetics?: string[] | null;
  fitPreferences?: string[] | null;
  favoriteColors?: string[] | null;
  avoidedColors?: string[] | null;
  budgetRange?: string | null;
  favoriteBrands?: string[] | null;
  sustainableFashionInterest?: boolean | null;
  pricePreference?: string | null;
  outfitGoals?: string[] | null;
  avatarMode?: string | null;
  avatarPreset?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<User>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Unconditionally true, and deliberately NOT seeded from the stored token.
  // Every `useRequireAuth` consumer renders `null` while this is true, so
  // seeding it made the server prerender the whole protected page instead of
  // nothing — and the hydration mismatch that followed rendered the form on
  // /designer/products/new *twice*. Four E2E tests caught it; "React recovers
  // from a mismatch" did not hold here.
  const [loading, setLoading] = useState(true);

  // Hydrate session on mount. Both branches settle through the same `.finally`
  // rather than the signed-out one returning after a synchronous
  // `setLoading(false)` — that is a cascading render the effect does not need
  // (react-hooks/set-state-in-effect), and resolving it a microtask later
  // keeps the server markup above identical.
  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const settled = token
      ? api
          .get<User>("/api/auth/me")
          .then(setUser)
          .catch(() => {
            localStorage.removeItem(AUTH_TOKEN_KEY);
          })
      : Promise.resolve();
    void settled.finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", { email, password });
    localStorage.setItem(AUTH_TOKEN_KEY, res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest): Promise<User> => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/register", data);
    // In prod the server rejects an unverified account's token, so storing it only
    // triggers a 401 bounce on the first protected call. Skip client auth entirely
    // and let the register page route to the verify-email page. Dev (gate off) is
    // unchanged — store the token and set the user as before.
    if (!(await isVerificationPending(res.user))) {
      localStorage.setItem(AUTH_TOKEN_KEY, res.token);
      setUser(res.user);
    }
    return res.user;
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileRequest) => {
    const updated = await api.put<User>("/api/auth/me", data);
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return;
    const updated = await api.get<User>("/api/auth/me");
    setUser(updated);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    // Clears the *stored* demo cart. The list on screen is emptied by
    // `CartProvider`, which owns it — this used to be the whole clear, written
    // against a second hardcoded copy of the key, so the items stayed visible
    // and the next add wrote them straight back.
    clearDemoCartItems();
    // The wishlist cache is per-user. Left behind on a shared device it would
    // show the previous account's saves, and the next sign-in would replay them
    // onto the new account as if they had been tapped there.
    clearSavedProducts();
    resetSavedProductsSync();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
