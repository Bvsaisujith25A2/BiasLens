"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { mapApiAnalysisToAnalysis } from "@/lib/types";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar?: string;
  createdAt: Date;
}

export interface Analysis {
  id: string;
  name: string;
  datasetName: string;
  createdAt: Date;
  status: "completed" | "processing" | "failed";
  fairnessScore: number;
  diversityScore: number;
  totalSamples: number;
  biasWarnings: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  analyses: Analysis[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  addAnalysis: (analysis: Analysis) => void;
  updateAnalysis: (id: string, updates: Partial<Analysis>) => void;
  refreshAnalyses: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  const syncUserAndAnalyses = useCallback(async () => {
    const profile = await api.getCurrentUser();
    const history = await api.getAnalysisHistory(1, 50);

    setUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role === "admin" ? "admin" : "user",
      createdAt: new Date(profile.created_at),
    });

    setAnalyses(
      history.analyses.map((item) => {
        const mapped = mapApiAnalysisToAnalysis(item);
        return {
          id: mapped.id,
          name: mapped.name,
          datasetName: mapped.datasetName,
          createdAt: mapped.createdAt,
          status: mapped.status === "pending" ? "processing" : mapped.status,
          fairnessScore: mapped.fairnessScore,
          diversityScore: mapped.diversityScore,
          totalSamples: mapped.totalSamples,
          biasWarnings: mapped.biasWarnings,
        } as Analysis;
      })
    );
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        await syncUserAndAnalyses();
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
        setAnalyses([]);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [syncUserAndAnalyses]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const auth = await api.login(email, password);
      localStorage.setItem("auth_token", auth.tokens.access_token);
      localStorage.setItem("refresh_token", auth.tokens.refresh_token);
      await syncUserAndAnalyses();
    } finally {
      setIsLoading(false);
    }
  }, [syncUserAndAnalyses]);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    setAnalyses([]);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const auth = await api.register(name, email, password);
      if (auth.tokens.access_token) {
        localStorage.setItem("auth_token", auth.tokens.access_token);
        localStorage.setItem("refresh_token", auth.tokens.refresh_token);
        await syncUserAndAnalyses();
        return;
      }

      // Fallback: in some auth settings signup creates the account but does not
      // return a session. Attempt immediate login with the same credentials.
      try {
        const signedIn = await api.login(email, password);
        localStorage.setItem("auth_token", signedIn.tokens.access_token);
        localStorage.setItem("refresh_token", signedIn.tokens.refresh_token);
        await syncUserAndAnalyses();
      } catch {
        throw new Error("Account created. Please sign in to continue.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [syncUserAndAnalyses]);

  const addAnalysis = useCallback((analysis: Analysis) => {
    setAnalyses((prev) => [analysis, ...prev]);
  }, []);

  const updateAnalysis = useCallback((id: string, updates: Partial<Analysis>) => {
    setAnalyses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const refreshAnalyses = useCallback(async () => {
    if (!user) {
      return;
    }
    const history = await api.getAnalysisHistory(1, 50);
    setAnalyses(
      history.analyses.map((item) => {
        const mapped = mapApiAnalysisToAnalysis(item);
        return {
          id: mapped.id,
          name: mapped.name,
          datasetName: mapped.datasetName,
          createdAt: mapped.createdAt,
          status: mapped.status === "pending" ? "processing" : mapped.status,
          fairnessScore: mapped.fairnessScore,
          diversityScore: mapped.diversityScore,
          totalSamples: mapped.totalSamples,
          biasWarnings: mapped.biasWarnings,
        } as Analysis;
      })
    );
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, analyses, login, logout, register, addAnalysis, updateAnalysis, refreshAnalyses }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
