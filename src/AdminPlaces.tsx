import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

type Rack = { id: string; name: string };
type Shelf = { id: string; name: string; rack_id: string | null };
type Loc = { id: string; name: string; active: boolean; kind: string; racks: Rack[]; shelves: Shelf[] };

const errText = (e: unknown): string => {
  if (e instanceof ApiError) {
    if (e.code === "name_taken") return "That name is already used.";
    if (e.code === "not_empty") return "It's not empty. Move its shelves or items first.";
    if (e.code === "system_location") return "Undelivered is built in and can't be changed.";
    if (e.code === "rack_not_in_location") return "That rack belongs to a different location.";
  }
  return "That didn't save. Check your connection and try again.";
};

export function AdminPlaces() {
  const [locs, setLocs] = useState<Loc[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => api<{ locations: Loc[] }>("/admin/catalog/places").then((r) => setLocs(r.locations)), []);
  useEffect(() => { load().catch(() => setError("Couldn't load places.")); }, [load]);

  const act = async (fn: () => Promise<{ locations: Loc[] }>) => {
    setError("");
    try { setLocs((await fn()).locations); return true; } catch (e) { setError(errText(e)); return false; }
  };
  const call = (path: string, method: string, body?: object) => () => api<{ locations: Loc[] }>(`/admin/catalog${path}`, { method, body: body ?? {} });

  const [newLoc, setNewLoc] = useState("");
  return (
    <>
      <h2>Places</h2>
      <p className="muted">Where stock lives. A location can have racks, and shelves go top to bottom. Volunteers count in this order.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (newLoc.trim() && (await act(call("/locations", "POST", { name: newLoc.trim() })))) setNewLoc(""); }}>
        <input aria-label="New location name" placeholder="New location, e.g. Cafe Pantry" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} maxLength={60} />
        <button className="btn primary" disabled={!newLoc.trim()}>Add location</button>
      </form>
      <ul className="cards">
        {locs?.map((l) => (l.kind === "undelivered" ? (
          <li key={l.id} className="card disabled"><strong>Undelivered</strong><div className="muted small">Built in. Bought stock waits here until it is checked in. It can't be changed or counted.</div></li>
        ) : (
          <LocCard key={l.id} l={l} act={act} call={call} />
        )))}
      </ul>
    </>
  );
}

function Rename({ value, onSave }: { value: string; onSave: (n: string) => Promise<boolean> }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (!edit) return <button className="link" onClick={() => { setV(value); setEdit(true); }}>Rename</button>;
  return (
    <form className="row" onSubmit={async (e) => { e.preventDefault(); if (v.trim() && (await onSave(v.trim()))) setEdit(false); }}>
      <input aria-label="New name" value={v} onChange={(e) => setV(e.target.value)} maxLength={60} autoFocus />
      <button className="btn sm primary">Save</button><button type="button" className="btn sm" onClick={() => setEdit(false)}>Cancel</button>
    </form>
  );
}

type Act = (fn: () => Promise<{ locations: Loc[] }>) => Promise<boolean>;
type Call = (path: string, method: string, body?: object) => () => Promise<{ locations: Loc[] }>;
function Mover({ kind, id, act, call }: { kind: string; id: string; act: Act; call: Call }) {
  return (
    <span className="row">
      <button className="btn sm" aria-label="Move up" onClick={() => act(call(`/${kind}/${id}/move`, "POST", { dir: "up" }))}>▲</button>
      <button className="btn sm" aria-label="Move down" onClick={() => act(call(`/${kind}/${id}/move`, "POST", { dir: "down" }))}>▼</button>
    </span>
  );
}

function LocCard({ l, act, call }: { l: Loc; act: Act; call: Call }) {
  const [rack, setRack] = useState("");
  const [shelf, setShelf] = useState("");
  const [shelfRack, setShelfRack] = useState("");
  const rackName = (id: string | null) => l.racks.find((r) => r.id === id)?.name;
  return (
    <li className={`card${l.active ? "" : " off"}`}>
      <div className="line"><strong>{l.name}</strong>{!l.active && <span className="pill warn">Inactive</span>}</div>
      <div className="row wrap">
        <Mover kind="locations" id={l.id} act={act} call={call} />
        <Rename value={l.name} onSave={(n) => act(call(`/locations/${l.id}`, "PATCH", { name: n }))} />
        <button className="link" onClick={() => act(call(`/locations/${l.id}`, "PATCH", { active: !l.active }))}>{l.active ? "Deactivate" : "Reactivate"}</button>
      </div>

      <h4>Racks</h4>
      {l.racks.length === 0 && <p className="muted small">None. Racks are optional; a small location can use only shelves.</p>}
      <ul className="plain">{l.racks.map((r) => (
        <li key={r.id} className="row wrap"><span className="grow">{r.name}</span><Mover kind="racks" id={r.id} act={act} call={call} /><Rename value={r.name} onSave={(n) => act(call(`/racks/${r.id}`, "PATCH", { name: n }))} /><button className="link" onClick={() => act(call(`/racks/${r.id}`, "DELETE"))}>Delete</button></li>
      ))}</ul>
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (rack.trim() && (await act(call(`/locations/${l.id}/racks`, "POST", { name: rack.trim() })))) setRack(""); }}>
        <input aria-label={`New rack in ${l.name}`} placeholder="New rack, e.g. Rack 1" value={rack} onChange={(e) => setRack(e.target.value)} maxLength={60} /><button className="btn sm" disabled={!rack.trim()}>Add rack</button>
      </form>

      <h4>Shelves (top to bottom)</h4>
      {l.shelves.length === 0 && <p className="muted small">None yet.</p>}
      <ul className="plain">{l.shelves.map((s) => (
        <li key={s.id} className="row wrap"><span className="grow">{s.name}{rackName(s.rack_id) ? <small className="muted"> · {rackName(s.rack_id)}</small> : null}</span><Mover kind="shelves" id={s.id} act={act} call={call} /><Rename value={s.name} onSave={(n) => act(call(`/shelves/${s.id}`, "PATCH", { name: n }))} /><button className="link" onClick={() => act(call(`/shelves/${s.id}`, "DELETE"))}>Delete</button></li>
      ))}</ul>
      <form className="row wrap" onSubmit={async (e) => { e.preventDefault(); if (shelf.trim() && (await act(call(`/locations/${l.id}/shelves`, "POST", { name: shelf.trim(), rack_id: shelfRack || null })))) setShelf(""); }}>
        <input aria-label={`New shelf in ${l.name}`} placeholder="New shelf, e.g. Shelf 1 (top)" value={shelf} onChange={(e) => setShelf(e.target.value)} maxLength={60} />
        {l.racks.length > 0 && <select aria-label="On which rack" value={shelfRack} onChange={(e) => setShelfRack(e.target.value)}><option value="">No rack</option>{l.racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
        <button className="btn sm" disabled={!shelf.trim()}>Add shelf</button>
      </form>
    </li>
  );
}
