import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setUnauthorizedHandler } from "./api";

export type Role = "volunteer" | "manager" | "admin";
export type User = { id: string; display_name: string; role: Role };

type AuthState = { user: User | null; ready: boolean; signedIn: (u: User) => void; signOut: () => Promise<void> };
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api<{ user: User }>("/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const signOut = useCallback(async () => {
    await api("/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signedIn: setUser, signOut }), [user, ready, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export const roleLabel: Record<Role, string> = { volunteer: "Volunteer", manager: "Cafe Manager", admin: "Admin" };
