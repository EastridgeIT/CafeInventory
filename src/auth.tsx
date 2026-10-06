import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setUnauthorizedHandler } from "./api";

// Mirrors worker/permissions.ts (ADR-0005). The server enforces; the client only decides what to show.
export type Role = "general" | "shopper" | "admin";
export type Permission =
  | "inventory.count" | "inventory.checkin" | "inventory.rebalance" | "shopping.use" | "shopping.new_item"
  | "admin.users" | "admin.catalog" | "admin.void_any" | "admin.reports";
export type User = { id: string; display_name: string; roles: Role[]; permissions: Permission[] };

type AuthState = { user: User | null; ready: boolean; signedIn: (u: User) => void; signOut: () => Promise<void>; can: (p: Permission) => boolean };
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

  const value = useMemo(
    () => ({ user, ready, signedIn: setUser, signOut, can: (p: Permission) => !!user?.permissions.includes(p) }),
    [user, ready, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

export const ROLES: Role[] = ["general", "shopper", "admin"];
export const roleLabel: Record<Role, string> = { general: "General", shopper: "Shopper", admin: "Admin" };
export const roleHelp: Record<Role, string> = {
  general: "Count inventory, check in deliveries, move stock between places.",
  shopper: "Use the shopping list and record purchases.",
  admin: "Manage users, items and places, undo anyone's action, see reports.",
};
