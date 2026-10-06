import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { splitForBar } from "./nav";
import type { IconName, NavItem } from "./nav";

/** True at desktop width. Mobile gets a bottom tab bar; desktop gets a side menu. */
export function useWide(): boolean {
  const q = "(min-width: 900px)";
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

const PATHS: Record<IconName | "more", ReactElement> = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  count: <path d="M9 4h6v3H9zM7 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M9 14l2 2 4-4" />,
  shop: <path d="M3 4h2l2.4 11h10.2l2-8H6.2M9 20.5h.01M17 20.5h.01" />,
  checkin: <path d="M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10" />,
  rebalance: <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />,
  admin: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></>,
  more: <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3.2" />,
};
const Icon = ({ name }: { name: IconName | "more" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {PATHS[name]}
  </svg>
);

type Props = { items: NavItem[]; active: string; wide: boolean };

export function Menu({ items, active, wide }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [open]);

  if (wide) {
    return (
      <nav className="rail" aria-label="Main">
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <a href={i.hash} className="railink" aria-current={i.id === active ? "page" : undefined}>
                <Icon name={i.icon} />
                {i.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const { bar, more } = splitForBar(items);
  const moreActive = more.some((i) => i.id === active);
  return (
    <>
      <nav className="tabbar" aria-label="Main">
        {bar.map((i) => (
          <a key={i.id} href={i.hash} className="tab" aria-current={i.id === active ? "page" : undefined}>
            <Icon name={i.icon} />
            <span>{i.label}</span>
          </a>
        ))}
        {more.length > 0 && (
          <button type="button" className="tab" aria-haspopup="dialog" aria-expanded={open} aria-current={moreActive ? "page" : undefined} onClick={() => setOpen(true)}>
            <Icon name="more" />
            <span>More</span>
          </button>
        )}
      </nav>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <ul>
              {more.map((i) => (
                <li key={i.id}>
                  <a href={i.hash} className="railink" aria-current={i.id === active ? "page" : undefined} onClick={() => setOpen(false)}>
                    <Icon name={i.icon} />
                    {i.label}
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
