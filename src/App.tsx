import { useEffect, useState } from "react";
import { AdminUsers } from "./AdminUsers";
import { AuthProvider, roleLabel, useAuth } from "./auth";
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
  const { user, signOut } = useAuth();
  const hash = useHash();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const page = hash === "#/admin/users" && isAdmin ? "users" : "home";

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/">
          <img src="/icon.svg" alt="" width={36} height={36} />
          <span>Cafe Inventory</span>
        </a>
        <div className="who">
          <span>{user.display_name}<small className="muted"> · {roleLabel[user.role]}</small></span>
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
              <li className="card disabled"><strong>Quick Inventory</strong><div className="muted small">Coming next: count items by location, one tap at a time.</div></li>
              <li className="card disabled"><strong>Shopping lists</strong><div className="muted small">Coming soon: what to buy, by vendor.</div></li>
              {isAdmin && (
                <li><a className="card link" href="#/admin/users"><strong>Users</strong><div className="muted small">Add volunteers, set PINs, change roles.</div></a></li>
              )}
            </ul>
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
