import { useEffect, useState } from "react";
import { AdminUsers } from "./AdminUsers";
import { AuthProvider, roleLabel, useAuth } from "./auth";
import type { Permission } from "./auth";
import { SignIn } from "./SignIn";

const useHash = () => {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => {
    const on = () => setH(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return h;
};

function Shell() {
  const { user, signOut, can } = useAuth();
  const hash = useHash();
  if (!user) return null;
  const page = hash === "#/admin/users" && can("admin.users") ? "users" : "home";
  const soon = (p: Permission, title: string, text: string) =>
    can(p) && (
      <li className="card disabled"><strong>{title}</strong><div className="muted small">{text}</div></li>
    );

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/">
          <img src="/icon.svg" alt="" width={36} height={36} />
          <span>Cafe Inventory</span>
        </a>
        <div className="who">
          <span>{user.display_name}<small className="muted"> · {user.roles.map((r) => roleLabel[r]).join(" + ") || "No roles"}</small></span>
          <button className="btn sm" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main>
        {page === "users" ? (
          <>
            <a href="#/" className="back">← Home</a>
            <AdminUsers />
          </>
        ) : (
          <>
            <h2>Hello, {user.display_name}</h2>
            <ul className="cards">
              {soon("inventory.count", "Quick Inventory", "Coming next: count items by location, one tap at a time.")}
              {soon("inventory.checkin", "Check in deliveries", "Coming soon: put bought stock on the shelves.")}
              {soon("inventory.rebalance", "Rebalance", "Coming soon: move stock between places.")}
              {soon("shopping.use", "Shopping list", "Coming soon: what to buy, by vendor, and record what you bought.")}
              {can("admin.users") && (
                <li><a className="card link" href="#/admin/users"><strong>Users</strong><div className="muted small">Add volunteers, set PINs, change roles.</div></a></li>
              )}
            </ul>
            {user.roles.length === 0 && <p className="muted">You don't have any roles yet. Ask an admin to give you one.</p>}
          </>
        )}
      </main>
    </div>
  );
}

function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="boot muted" role="status">Loading…</p>;
  return user ? <Shell /> : <SignIn />;
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
