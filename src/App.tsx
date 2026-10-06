import { useEffect, useState } from "react";
import { AdminUsers } from "./AdminUsers";
import { AuthProvider, roleLabel, useAuth } from "./auth";
import { Menu, useWide } from "./Nav";
import { activeId, itemsFor } from "./nav";
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

const SOON: Record<string, { title: string; text: string }> = {
  count: { title: "Quick Inventory", text: "Coming next: count items by location, one tap at a time." },
  shop: { title: "Shopping list", text: "Coming soon: what to buy, by store, and record what you bought." },
  checkin: { title: "Check in deliveries", text: "Coming soon: put bought stock on the shelves." },
  rebalance: { title: "Rebalance", text: "Coming soon: move stock between places." },
};

function Soon({ id }: { id: string }) {
  const s = SOON[id]!;
  return (
    <>
      <h2>{s.title}</h2>
      <p className="muted">{s.text}</p>
    </>
  );
}

function Shell() {
  const { user, signOut, can } = useAuth();
  const hash = useHash();
  const wide = useWide();
  if (!user) return null;

  const items = itemsFor(user.permissions);
  const wanted = activeId(hash);
  const allowed = items.some((i) => i.id === wanted);
  const active = allowed ? wanted : "home";
  const showUsers = active === "admin" && hash === "#/admin/users" && can("admin.users");

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#/">
          <img src="/icon.svg" alt="" width={36} height={36} />
          <span>Cafe Inventory</span>
        </a>
        <div className="who">
          <span>
            {user.display_name}
            <small className="muted"> · {user.roles.map((r) => roleLabel[r]).join(" + ") || "No roles"}</small>
          </span>
          <button className="btn sm" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="layout">
        {wide && <Menu items={items} active={active} wide />}
        <main id="main">
          {active === "home" && (
            <>
              <h2>Hello, {user.display_name}</h2>
              <ul className="cards">
                {items.filter((i) => i.id !== "home" && i.id !== "admin").map((i) => (
                  <li key={i.id}>
                    <a className="card" href={i.hash}>
                      <strong>{SOON[i.id]?.title}</strong>
                      <div className="muted small">{SOON[i.id]?.text}</div>
                    </a>
                  </li>
                ))}
                {can("admin.users") && (
                  <li>
                    <a className="card link" href="#/admin/users"><strong>Users</strong><div className="muted small">Add people, set PINs, change roles.</div></a>
                  </li>
                )}
              </ul>
              {user.roles.length === 0 && <p className="muted">You don't have any roles yet. Ask an admin to give you one.</p>}
            </>
          )}
          {active in SOON && <Soon id={active} />}
          {active === "admin" && !showUsers && (
            <>
              <h2>Admin</h2>
              <ul className="cards">
                {can("admin.users") && (
                  <li><a className="card link" href="#/admin/users"><strong>Users</strong><div className="muted small">Add people, set PINs, change roles.</div></a></li>
                )}
                <li className="card disabled"><strong>Items, places and shelves</strong><div className="muted small">Coming next: items, locations, racks, shelves, vendors, bulk placement.</div></li>
              </ul>
            </>
          )}
          {showUsers && (
            <>
              <a href="#/admin" className="back">← Admin</a>
              <AdminUsers />
            </>
          )}
        </main>
      </div>
      {!wide && <Menu items={items} active={active} wide={false} />}
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
