'use client';
import { useState } from 'react';

export interface ReceiptItem { name: string; price: number; qty?: number }
export interface ReceiptPrinterProps {
  items?: ReceiptItem[];
  /** Defaults to the sum of the items. */
  total?: number;
  currency?: string;
  title?: string;
  /** Show the small replay button. */
  replayable?: boolean;
}

const DEFAULT_ITEMS: ReceiptItem[] = [
  { name: 'Flat white', price: 3.8, qty: 2 },
  { name: 'Almond croissant', price: 3.5 },
  { name: 'Oat bottle', price: 4.2 },
];

/** A slot at the top feeds out a paper receipt line by line. With reduced motion the whole receipt is simply there. */
export default function ReceiptPrinter({ items = DEFAULT_ITEMS, total, currency = 'USD', title = 'Payment received', replayable = true }: ReceiptPrinterProps) {
  const [run, setRun] = useState(0);
  const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  const sum = total ?? items.reduce((s, it) => s + it.price * (it.qty ?? 1), 0);
  const steps = items.length + 4;
  return (
    <div className="ui-receipt-printer" style={{ ['--ui-receipt-printer-steps' as string]: steps }}>
      <div className="ui-receipt-printer-head">
        <div className="ui-receipt-printer-slot" aria-hidden="true" />
        {replayable && (
          <button type="button" className="ui-receipt-printer-replay" onClick={() => setRun((v) => v + 1)} aria-label="Replay receipt printing">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.8-3.8M3 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>
      <div className="ui-receipt-printer-window">
        <div className="ui-receipt-printer-paper" key={run} role="group" aria-label={`Receipt, total ${money(sum)}`}>
          <p className="ui-receipt-printer-title">{title}</p>
          <ul className="ui-receipt-printer-list">
            {items.map((it, i) => (
              <li key={`${it.name}-${i}`}>
                <span>{it.qty && it.qty > 1 ? `${it.qty} x ` : ''}{it.name}</span>
                <span>{money(it.price * (it.qty ?? 1))}</span>
              </li>
            ))}
          </ul>
          <p className="ui-receipt-printer-total"><span>Total</span><span>{money(sum)}</span></p>
          <div className="ui-receipt-printer-tear" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function Demo() {
  return <ReceiptPrinter />;
}
