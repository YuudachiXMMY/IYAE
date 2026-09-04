"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { api, type RegisterRequest, type UpdateProfileRequest } from "./api";

interface User {
  id: number;
  email: string;
  name: string | null;
  role: "BUYER" | "DESIGNER";
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
  register: (data: RegisterRequest) => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate session on mount
  useEffect(() => {
    const token = localStorage.getItem("clossette_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.get<User>("/api/auth/me")
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("clossette_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", { email, password });
    localStorage.setItem("clossette_token", res.token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/register", data);
    localStorage.setItem("clossette_token", res.token);
    setUser(res.user);
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileRequest) => {
    const updated = await api.put<User>("/api/auth/me", data);
    setUser(updated);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("clossette_token");
    if (!token) return;
    const updated = await api.get<User>("/api/auth/me");
    setUser(updated);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("clossette_token");
    localStorage.removeItem("clossette_demo_cart_items");
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
