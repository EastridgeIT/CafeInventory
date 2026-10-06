import { useEffect, useState } from "react";
import { AdminItems } from "./AdminItems";
import { AdminPlaces } from "./AdminPlaces";
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

// Placeholder text for sections that are not built yet.
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
  const sub = active === "admin" ? hash.replace(/^#\/admin\/?/, "") : "";
  const showUsers = sub === "users" && can("admin.users");
  const showItems = sub === "items" && can("admin.catalog");
  const showPlaces = sub === "places" && can("admin.catalog");

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
              <section className="reminders" aria-labelledby="rem-h">
                <h3 id="rem-h">Reminders</h3>
                {/* Reminders appear here at their time (design: knowledge/architecture/reminders.md). None are built yet. */}
                <p className="none" role="status">No reminders due.</p>
              </section>
              {user.roles.length === 0 && <p className="muted">You don't have any roles yet. Ask an admin to give you one.</p>}
            </>
          )}
          {active in SOON && <Soon id={active} />}
          {active === "admin" && !showUsers && !showItems && !showPlaces && (
            <>
              <h2>Admin</h2>
              <ul className="cards">
                {can("admin.users") && <li><a className="card link" href="#/admin/users"><strong>Users</strong><div className="muted small">Add people, set PINs, change roles.</div></a></li>}
                {can("admin.catalog") && <li><a className="card link" href="#/admin/items"><strong>Items</strong><div className="muted small">Everything the cafe stocks, with sizes, minimums and categories.</div></a></li>}
                {can("admin.catalog") && <li><a className="card link" href="#/admin/places"><strong>Places</strong><div className="muted small">Locations, racks and shelves.</div></a></li>}
              </ul>
            </>
          )}
          {(showUsers || showItems || showPlaces) && <a href="#/admin" className="back">← Admin</a>}
          {showUsers && <AdminUsers />}
          {showItems && <AdminItems />}
          {showPlaces && <AdminPlaces />}
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
