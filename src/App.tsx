import { useEffect, useState } from "react";

type Health = "checking" | "ok" | "down";

export function App() {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<{ ok: boolean }>)
      .then((b) => setHealth(b.ok ? "ok" : "down"))
      .catch(() => setHealth("down"));
  }, []);

  return (
    <main className="shell">
      <header className="brand">
        <img src="/icon.svg" alt="" width={40} height={40} />
        <h1>Cafe Inventory</h1>
      </header>
      <section className="card">
        <p>Coming soon: quick stock counts and deliveries for volunteers, and reorder lists for the Cafe Manager.</p>
        <p className={`status status-${health}`} role="status">
          {health === "checking" && "Checking connection…"}
          {health === "ok" && "Connected"}
          {health === "down" && "Can't reach the server"}
        </p>
      </section>
    </main>
  );
}
