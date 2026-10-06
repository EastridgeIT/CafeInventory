import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import { useAuth } from "./auth";
import type { User } from "./auth";

type Pick = { id: string; display_name: string };

function loginMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "invalid_login") return "That PIN didn't match. Try again.";
    if (e.code === "locked") return `Too many wrong PINs. Try again in ${Math.max(1, Math.ceil(Number(e.data.retry_after_s ?? 900) / 60))} minutes, or ask the Cafe Manager.`;
    if (e.code === "too_many_attempts") return "Too many attempts from this device. Wait a few minutes and try again.";
    if (e.code === "invalid_request") return "A PIN is 4 to 8 numbers.";
  }
  return "Couldn't reach the server. Check your connection and try again.";
}

export function SignIn() {
  const { signedIn } = useAuth();
  const [people, setPeople] = useState<Pick[] | null>(null);
  const [who, setWho] = useState<Pick | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ users: Pick[] }>("/login/users").then((r) => setPeople(r.users)).catch(() => setPeople([]));
  }, []);
  useEffect(() => {
    if (who) pinRef.current?.focus();
  }, [who]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!who || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: User }>("/login", { method: "POST", body: { user_id: who.id, pin } });
      signedIn(r.user);
    } catch (err) {
      setError(loginMessage(err));
      setPin("");
      pinRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell narrow">
      <header className="brand">
        <img src="/icon.svg" alt="" width={44} height={44} />
        <h1>Cafe Inventory</h1>
      </header>

      {!who ? (
        <section className="panel" aria-labelledby="who">
          <h2 id="who">Who's counting?</h2>
          {people === null && <p className="muted">Loading names…</p>}
          {people?.length === 0 && <p className="muted">No names to show. Check your connection, or ask the Cafe Manager to add you.</p>}
          <ul className="names">
            {people?.map((p) => (
              <li key={p.id}>
                <button className="btn big" onClick={() => setWho(p)}>
                  {p.display_name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <form className="panel" onSubmit={submit} aria-labelledby="pinh">
          <h2 id="pinh">Hi, {who.display_name}</h2>
          <label htmlFor="pin" className="muted">
            Enter your PIN
          </label>
          <input
            ref={pinRef}
            id="pin"
            className="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            aria-describedby={error ? "pin-error" : undefined}
          />
          {error && (
            <p id="pin-error" role="alert" className="error">
              {error}
            </p>
          )}
          <div className="row">
            <button type="button" className="btn" onClick={() => { setWho(null); setPin(""); setError(""); }}>
              Not me
            </button>
            <button type="submit" className="btn primary grow" disabled={busy || pin.length < 4}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
