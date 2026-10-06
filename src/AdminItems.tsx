import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "./api";

type Variant = { id?: string; name: string; equals: number | null };
type Method = "whole" | "decimal" | "level";
type Item = {
  id: string; name: string; category: string | null; unit_label: string; measurement_method: Method; quick_max: number | null; par_level: number | null;
  in_quick_inventory: boolean; ask_markout: boolean; needs_review: boolean; active: boolean; variants: Variant[]; buy_variant_id: string | null; count_variant_id: string | null;
};
type List = { items: Item[]; categories: string[] };

const METHODS: Record<Method, string> = { whole: "Whole numbers", decimal: "Halves and decimals", level: "Fullness level (open + sealed)" };
const errText = (e: unknown): string => {
  if (e instanceof ApiError) {
    const m: Record<string, string> = {
      name_taken: "An item with that name already exists.",
      quick_max_below_par: "The quick buttons must go at least as high as the par level, so \"More than\" can never hide a reorder.",
      quick_max_needs_whole: "Quick buttons only work with whole-number counting.",
      duplicate_variant: "Two variants have the same name.",
      unknown_variant: "Pick a variant that exists.",
      invalid_request: "Check the fields: a name and unit are required, quick buttons go from 1 to 24.",
    };
    if (m[e.code]) return m[e.code]!;
  }
  return "That didn't save. Check your connection and try again.";
};

export function AdminItems() {
  const [data, setData] = useState<List | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [review, setReview] = useState(false);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (cat) p.set("category", cat);
    if (review) p.set("needs_review", "1");
    setData(await api<List>(`/admin/catalog/items?${p}`));
  }, [q, cat, review]);
  useEffect(() => {
    const t = setTimeout(() => load().catch(() => setError("Couldn't load items.")), 200);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (id: string | "new", body: object): Promise<boolean> => {
    setError(""); setNote("");
    try {
      const r = await api<{ item: Item }>(id === "new" ? "/admin/catalog/items" : `/admin/catalog/items/${id}`, { method: id === "new" ? "POST" : "PATCH", body });
      setNote(id === "new" ? `Added ${r.item.name}.` : `Saved ${r.item.name}.`);
      setEditing(null);
      await load();
      return true;
    } catch (e) {
      setError(errText(e));
      return false;
    }
  };

  return (
    <>
      <h2>Items</h2>
      <p className="muted">Everything the cafe stocks. Items marked <b>Needs setup</b> are drafts: they stay out of Quick Inventory until you finish them.</p>
      <div className="toolbar">
        <input type="search" aria-label="Search items" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {data?.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn" aria-pressed={review} onClick={() => setReview((v) => !v)}>Needs setup only</button>
        <button className="btn primary" onClick={() => { setEditing("new"); setError(""); }}>Add item</button>
      </div>
      <div aria-live="polite">{note && <p className="ok">{note}</p>}{error && <p className="error" role="alert">{error}</p>}</div>
      {editing === "new" && <ItemForm categories={data?.categories ?? []} onSave={(b) => save("new", b)} onCancel={() => setEditing(null)} />}
      {data && <p className="muted small">{data.items.length} item{data.items.length === 1 ? "" : "s"}{data.items.filter((i) => i.needs_review).length ? ` · ${data.items.filter((i) => i.needs_review).length} need setup` : ""}</p>}
      <ul className="cards">
        {data?.items.map((it) => (
          <li key={it.id} className={`card${it.active ? "" : " off"}`}>
            <div className="line">
              <strong>{it.name}</strong>
              {it.needs_review && <span className="pill warn">Needs setup</span>}
              {!it.active && <span className="pill warn">Inactive</span>}
            </div>
            <div className="muted small">
              {[it.category, it.unit_label, METHODS[it.measurement_method], it.par_level !== null ? `par ${it.par_level}` : null, it.quick_max ? `buttons 1 to ${it.quick_max}` : null, it.ask_markout ? "asks about markouts" : null].filter(Boolean).join(" · ")}
            </div>
            {it.variants.length > 0 && (
              <div className="muted small">Variants: {it.variants.map((v) => `${v.name}${v.equals !== null && v.equals !== 1 ? ` (${v.equals})` : v.equals === null ? " (? )" : ""}${v.id === it.buy_variant_id ? " · buy" : ""}${v.id === it.count_variant_id ? " · count" : ""}`).join(", ")}</div>
            )}
            {editing === it.id ? (
              <ItemForm item={it} categories={data.categories} onSave={(b) => save(it.id, b)} onCancel={() => setEditing(null)} />
            ) : (
              <div className="row wrap"><button className="btn sm" onClick={() => { setEditing(it.id); setError(""); }}>Edit</button></div>
            )}
          </li>
        ))}
      </ul>
      {data && data.items.length === 0 && <p className="muted">No items match.</p>}
    </>
  );
}

function ItemForm({ item, categories, onSave, onCancel }: { item?: Item; categories: string[]; onSave: (b: object) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [unit, setUnit] = useState(item?.unit_label ?? "each");
  const [method, setMethod] = useState<Method>(item?.measurement_method ?? "whole");
  const [quick, setQuick] = useState(item?.quick_max ? String(item.quick_max) : "");
  const [par, setPar] = useState(item?.par_level !== null && item?.par_level !== undefined ? String(item.par_level) : "");
  const [inQuick, setInQuick] = useState(item?.in_quick_inventory ?? true);
  const [markout, setMarkout] = useState(item?.ask_markout ?? false);
  const [done, setDone] = useState(item ? !item.needs_review : true);
  const [variants, setVariants] = useState<{ id?: string; name: string; equals: string }[]>(item?.variants.map((v) => ({ id: v.id, name: v.name, equals: v.equals === null ? "" : String(v.equals) })) ?? []);
  const [buy, setBuy] = useState(item?.variants.find((v) => v.id === item.buy_variant_id)?.name ?? "");
  const [count, setCount] = useState(item?.variants.find((v) => v.id === item.count_variant_id)?.name ?? "");
  const named = variants.filter((v) => v.name.trim());

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSave({
      name: name.trim(), category: category.trim() || null, unit_label: unit.trim() || "each", measurement_method: method,
      quick_max: method === "whole" && quick ? Number(quick) : null, par_level: par === "" ? null : Number(par),
      in_quick_inventory: inQuick, ask_markout: markout, needs_review: !done,
      variants: named.map((v) => ({ ...(v.id ? { id: v.id } : {}), name: v.name.trim(), equals: v.equals === "" ? null : Number(v.equals) })),
      buy_variant: named.length ? buy || named[0]!.name.trim() : null, count_variant: named.length ? count || named[0]!.name.trim() : null,
    });
  }
  const setV = (i: number, patch: Partial<{ name: string; equals: string }>) => setVariants((vs) => vs.map((v, n) => (n === i ? { ...v, ...patch } : v)));

  return (
    <form className="form panel" onSubmit={submit}>
      <h3>{item ? `Edit ${item.name}` : "New item"}</h3>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="off" /></label>
      <div className="row wrap">
        <label className="grow">Category<input list="cats" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={40} /><datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="grow">Counted in (the base unit)<input value={unit} onChange={(e) => setUnit(e.target.value)} required maxLength={30} placeholder="bottles, gallons, sleeves…" /></label>
      </div>
      <label>How it's counted
        <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>{(Object.keys(METHODS) as Method[]).map((m) => <option key={m} value={m}>{METHODS[m]}</option>)}</select>
      </label>
      <div className="row wrap">
        {method === "whole" && (
          <label className="grow">One-tap number buttons up to
            <select value={quick} onChange={(e) => setQuick(e.target.value)}><option value="">None (use the keypad)</option>{Array.from({ length: 24 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
          </label>
        )}
        <label className="grow">Par level (the least we want on hand)<input type="number" min="0" step="any" value={par} onChange={(e) => setPar(e.target.value)} placeholder={`in ${unit || "units"}`} /></label>
      </div>

      <fieldset className="roles">
        <legend>Variants (sizes or packages of this one item)</legend>
        {variants.length === 0 && <p className="muted small">None. Add variants only if it comes in more than one size or package, like Gallon and Half Gallon.</p>}
        {variants.map((v, i) => (
          <div className="row" key={i}>
            <input aria-label="Variant name" value={v.name} onChange={(e) => setV(i, { name: e.target.value })} placeholder="e.g. Half Gallon" maxLength={40} />
            <input aria-label={`How many ${unit} it equals`} type="number" min="0" step="any" value={v.equals} onChange={(e) => setV(i, { equals: e.target.value })} placeholder={`= how many ${unit}?`} />
            <button type="button" className="btn sm" aria-label="Remove variant" onClick={() => setVariants((vs) => vs.filter((_, n) => n !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn sm" onClick={() => setVariants((vs) => [...vs, { name: "", equals: "" }])}>Add a variant</button>
        {named.length > 0 && (
          <div className="row wrap">
            <label className="grow">Prefer to buy<select value={buy || named[0]!.name} onChange={(e) => setBuy(e.target.value)}>{named.map((v) => <option key={v.name}>{v.name.trim()}</option>)}</select></label>
            <label className="grow">Prefer to count<select value={count || named[0]!.name} onChange={(e) => setCount(e.target.value)}>{named.map((v) => <option key={v.name}>{v.name.trim()}</option>)}</select></label>
          </div>
        )}
      </fieldset>

      <label className="check"><input type="checkbox" checked={inQuick} onChange={(e) => setInQuick(e.target.checked)} /><span><strong>Include in Quick Inventory</strong><small className="muted">Volunteers count it on their regular pass.</small></span></label>
      <label className="check"><input type="checkbox" checked={markout} onChange={(e) => setMarkout(e.target.checked)} /><span><strong>Ask about markouts</strong><small className="muted">When counted at 0: "Did we mark any out to avoid expiration?"</small></span></label>
      <label className="check"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /><span><strong>Setup is complete</strong><small className="muted">Unchecked items are drafts and stay out of Quick Inventory.</small></span></label>
      <div className="row"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btn primary grow" type="submit" disabled={!name.trim()}>{item ? "Save" : "Add item"}</button></div>
    </form>
  );
}
