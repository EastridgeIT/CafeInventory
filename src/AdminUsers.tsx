import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";
import { ROLES, roleHelp, roleLabel, useAuth } from "./auth";
import type { Role } from "./auth";

type Row = { id: string; display_name: string; email: string | null; roles: Role[]; toast_employee_ref: string | null; active: number };

const errText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.code === "name_taken") return "Someone already has that name.";
    if (e.code === "email_taken") return "Someone already has that email address.";
    if (e.code === "last_admin") return "There must be at least one active person with the Admin role.";
    if (e.code === "invalid_request") return "Check the fields. Pick at least one role, use a valid email, and a PIN of 4 to 8 numbers.";
  }
  return "That didn't save. Check your connection and try again.";
};

export function AdminUsers() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => api<{ users: Row[] }>("/admin/users").then((r) => setRows(r.users)), []);
  useEffect(() => {
    load().catch(() => setError("Couldn't load users."));
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError("");
    setNote("");
    try {
      await fn();
      setNote(ok);
      await load();
      return true;
    } catch (e) {
      setError(errText(e));
      return false;
    }
  };

  return (
    <>
      <h2>Users</h2>
      <p className="muted">People sign in by picking their name and entering a PIN. PINs are never shown, only set or reset. Roles stack: someone can be General and Shopper, and they get everything both allow.</p>
      <div aria-live="polite">
        {note && <p className="ok">{note}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>

      <AddUser onAdd={(b) => run(() => api("/admin/users", { method: "POST", body: b }), `Added ${b.display_name}.`)} />

      <ul className="cards">
        {rows?.map((r) => (
          <UserCard key={r.id} r={r} isMe={r.id === me?.id} run={run} />
        ))}
      </ul>
      {rows === null && !error && <p className="muted">Loading…</p>}
    </>
  );
}

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  const toggle = (r: Role) => onChange(value.includes(r) ? value.filter((x) => x !== r) : ROLES.filter((x) => x === r || value.includes(x)));
  return (
    <fieldset className="roles">
      <legend>Roles (pick any that apply)</legend>
      {ROLES.map((r) => (
        <label key={r} className="check">
          <input type="checkbox" checked={value.includes(r)} onChange={() => toggle(r)} />
          <span><strong>{roleLabel[r]}</strong><small className="muted">{roleHelp[r]}</small></span>
        </label>
      ))}
    </fieldset>
  );
}

function AddUser({ onAdd }: { onAdd: (b: { display_name: string; roles: Role[]; pin: string; toast_employee_ref: string | null; email: string | null }) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>(["general"]);
  const [pin, setPin] = useState("");
  const [toast, setToast] = useState("");
  const [email, setEmail] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onAdd({ display_name: name.trim(), roles, pin, toast_employee_ref: toast.trim() || null, email: email.trim() || null })) {
      setName(""); setPin(""); setToast(""); setEmail(""); setRoles(["general"]); setOpen(false);
    }
  }
  if (!open) return <button className="btn primary" onClick={() => setOpen(true)}>Add user</button>;
  return (
    <form className="panel form" onSubmit={submit}>
      <h3>New user</h3>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="off" /></label>
      <label>Email (for scheduled-inventory reminders)<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="off" placeholder="name@example.com" /></label>
      <RolePicker value={roles} onChange={setRoles} />
      <label>PIN (4 to 8 numbers)<input type="password" inputMode="numeric" pattern="[0-9]{4,8}" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required maxLength={8} autoComplete="new-password" /></label>
      <label>Toast employee ID (optional)<input value={toast} onChange={(e) => setToast(e.target.value)} maxLength={60} autoComplete="off" /></label>
      <div className="row">
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
        <button type="submit" className="btn primary grow" disabled={!name.trim() || pin.length < 4 || roles.length === 0}>Add user</button>
      </div>
    </form>
  );
}

type Mode = "view" | "edit" | "pin" | "off";
function UserCard({ r, isMe, run }: { r: Row; isMe: boolean; run: (fn: () => Promise<unknown>, ok: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<Mode>("view");
  const [name, setName] = useState(r.display_name);
  const [roles, setRoles] = useState<Role[]>(r.roles);
  const [toast, setToast] = useState(r.toast_employee_ref ?? "");
  const [email, setEmail] = useState(r.email ?? "");
  const [pin, setPin] = useState("");
  const done = () => setMode("view");

  return (
    <li className={`card${r.active ? "" : " off"}`}>
      <div className="line">
        <strong>{r.display_name}{isMe && " (you)"}</strong>
        {r.roles.map((x) => <span key={x} className="pill">{roleLabel[x]}</span>)}
        {!r.active && <span className="pill warn">Inactive</span>}
      </div>
      {r.email ? <div className="muted small">{r.email}</div> : <div className="muted small">No email yet</div>}
      {r.toast_employee_ref && <div className="muted small">Toast ID {r.toast_employee_ref}</div>}

      {mode === "view" && (
        <div className="row wrap">
          <button className="btn sm" onClick={() => setMode("edit")}>Edit</button>
          <button className="btn sm" onClick={() => setMode("pin")}>Set PIN</button>
          {r.active ? (
            <button className="btn sm" onClick={() => setMode("off")}>Deactivate</button>
          ) : (
            <button className="btn sm" onClick={() => run(() => api(`/admin/users/${r.id}`, { method: "PATCH", body: { active: true } }), `${r.display_name} is active again.`)}>Reactivate</button>
          )}
        </div>
      )}

      {mode === "edit" && (
        <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api(`/admin/users/${r.id}`, { method: "PATCH", body: { display_name: name.trim(), roles, toast_employee_ref: toast.trim() || null, email: email.trim() || null } }), "Saved.")) done(); }}>
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="off" /></label>
          <RolePicker value={roles} onChange={setRoles} />
          <p className="muted small">Changing roles signs this person out so the new roles apply right away.</p>
          <label>Toast employee ID<input value={toast} onChange={(e) => setToast(e.target.value)} maxLength={60} /></label>
          <div className="row"><button type="button" className="btn sm" onClick={done}>Cancel</button><button className="btn sm primary grow" type="submit" disabled={roles.length === 0}>Save</button></div>
        </form>
      )}

      {mode === "pin" && (
        <form className="form" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api(`/admin/users/${r.id}/pin`, { method: "POST", body: { pin } }), `New PIN set for ${r.display_name}.`)) { setPin(""); done(); } }}>
          <label>New PIN (4 to 8 numbers)<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} maxLength={8} autoComplete="new-password" required /></label>
          <p className="muted small">Setting a PIN signs {r.display_name} out everywhere and clears any lockout.</p>
          <div className="row"><button type="button" className="btn sm" onClick={() => { setPin(""); done(); }}>Cancel</button><button className="btn sm primary grow" type="submit" disabled={pin.length < 4}>Set PIN</button></div>
        </form>
      )}

      {mode === "off" && (
        <div className="form">
          <p>Deactivate {r.display_name}? They are signed out right away and can't sign in until reactivated. Their past counts stay.</p>
          <div className="row"><button className="btn sm" onClick={done}>Keep active</button><button className="btn sm danger grow" onClick={async () => { if (await run(() => api(`/admin/users/${r.id}`, { method: "PATCH", body: { active: false } }), `${r.display_name} is inactive.`)) done(); else done(); }}>Deactivate</button></div>
        </div>
      )}
    </li>
  );
}
