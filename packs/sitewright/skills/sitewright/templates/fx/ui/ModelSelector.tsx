'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectorItem {
  id: string;
  name: string;
  tag?: string;
  group?: string;
  /** Metric bars, values 0..1. */
  metrics?: { label: string; value: number }[];
  /** Config choices shown for the selected item (a segmented control). */
  efforts?: string[];
}
export interface ModelSelectorProps {
  items?: SelectorItem[];
  value?: string;
  onChange?: (id: string, effort?: string) => void;
  effortLabel?: string;
  'aria-label'?: string;
}

const SAMPLE: SelectorItem[] = [
  { id: 'standard', name: 'Standard', tag: 'Default', group: 'Balanced', metrics: [{ label: 'Speed', value: 0.6 }, { label: 'Quality', value: 0.7 }], efforts: ['Low', 'Medium', 'High'] },
  { id: 'extended', name: 'Extended', tag: 'Deep', group: 'Balanced', metrics: [{ label: 'Speed', value: 0.3 }, { label: 'Quality', value: 0.95 }], efforts: ['Medium', 'High', 'Max'] },
  { id: 'fast', name: 'Fast', tag: 'Light', group: 'Quick', metrics: [{ label: 'Speed', value: 0.95 }, { label: 'Quality', value: 0.45 }], efforts: ['Low', 'Medium'] },
];

/** A keyboard-navigable listbox of grouped options; the selected option reveals a segmented configuration row. */
export default function ModelSelector({ items = SAMPLE, value, onChange, effortLabel = 'Effort', 'aria-label': label = 'Choose an option' }: ModelSelectorProps) {
  const uid = useId();
  const [sel, setSel] = useState(value ?? items[0]?.id ?? '');
  const [efforts, setEfforts] = useState<Record<string, string>>({});
  const [active, setActive] = useState(Math.max(0, items.findIndex((i) => i.id === sel)));
  const typed = useRef({ s: '', t: 0 });
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  const cur = value ?? sel;
  const go = (i: number) => { const n = (i + items.length) % items.length; setActive(n); refs.current[n]?.scrollIntoView({ block: 'nearest' }); };
  const pick = (i: number) => {
    const it = items[i]; if (!it) return;
    setSel(it.id); setActive(i);
    onChange?.(it.id, efforts[it.id] ?? it.efforts?.[0]);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); go(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(items.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(active); }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = typed.current; window.clearTimeout(t.t);
      t.s += e.key.toLowerCase(); t.t = window.setTimeout(() => { t.s = ''; }, 600);
      const from = t.s.length === 1 ? active + 1 : active;
      for (let k = 0; k < items.length; k++) { const i = (from + k) % items.length; if (items[i]?.name.toLowerCase().startsWith(t.s)) { go(i); break; } }
    }
  };
  const selItem = items.find((i) => i.id === cur);
  const eff = selItem ? efforts[selItem.id] ?? selItem.efforts?.[0] : undefined;
  let lastGroup: string | undefined;
  return (
    <div className="ui-model-selector-root">
      <ul role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${uid}-${active}`} className="ui-model-selector-list" onKeyDown={key}>
        {items.map((it, i) => {
          const head = it.group && it.group !== lastGroup ? it.group : null; lastGroup = it.group;
          return (
            <li key={it.id} role="presentation" className="ui-model-selector-row">
              {head && <div className="ui-model-selector-group" aria-hidden="true">{head}</div>}
              <div id={`${uid}-${i}`} ref={(n) => { refs.current[i] = n as unknown as HTMLLIElement; }} role="option" aria-selected={it.id === cur} data-active={i === active} className="ui-model-selector-opt" onClick={() => pick(i)}>
                <span className="ui-model-selector-name">{it.name}{it.tag && <span className="ui-model-selector-tag">{it.tag}</span>}</span>
                <span className="ui-model-selector-bars" aria-hidden="true">
                  {it.metrics?.map((m) => <span key={m.label} className="ui-model-selector-bar" title={m.label}><i style={{ width: `${Math.round(m.value * 100)}%` }} /></span>)}
                </span>
                <span className="ui-model-selector-sr">{it.metrics?.map((m) => `${m.label} ${Math.round(m.value * 100)}%`).join(', ')}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {selItem?.efforts && (
        <div className="ui-model-selector-config" role="radiogroup" aria-label={`${effortLabel} for ${selItem.name}`}>
          <span className="ui-model-selector-cfglabel">{effortLabel}</span>
          {selItem.efforts.map((x) => (
            <button key={x} type="button" role="radio" aria-checked={x === eff} className="ui-model-selector-seg" onClick={() => { setEfforts((p) => ({ ...p, [selItem.id]: x })); onChange?.(selItem.id, x); }}>{x}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Demo() { return <ModelSelector items={SAMPLE.map((i) => ({ ...i, group: undefined }))} />; }
