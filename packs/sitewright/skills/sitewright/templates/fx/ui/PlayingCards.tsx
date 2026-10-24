'use client';
import { useRef, useState, type KeyboardEvent } from 'react';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface CardData { rank: Rank; suit: Suit }
export interface PlayingCardProps extends CardData { faceDown?: boolean; className?: string }
export interface PlayingCardsProps {
  cards?: CardData[];
  /** Fan spread in degrees between neighbouring cards. */
  spread?: number;
  onPlay?: (card: CardData) => void;
}

const NAMES: Record<string, string> = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
const label = (c: CardData) => `${NAMES[c.rank] ?? c.rank} of ${c.suit}`;

export function SuitIcon({ suit, size = 12 }: { suit: Suit; size?: number }) {
  const p = { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, focusable: false, fill: 'currentColor' } as const;
  if (suit === 'hearts') return <svg {...p}><path d="M12 21.5C5 15.5 2 12 2 8.2 2 5.2 4.3 3 7 3c2 0 4 1.1 5 3 1-1.9 3-3 5-3 2.7 0 5 2.2 5 5.2 0 3.8-3 7.3-10 13.3z" /></svg>;
  if (suit === 'diamonds') return <svg {...p}><path d="M12 1.5 20.5 12 12 22.5 3.5 12z" /></svg>;
  if (suit === 'spades') return <svg {...p}><path d="M12 2S3 9 3 14c0 3 2.5 4.5 5 4.5 1.5 0 2.8-.7 3.3-1.700-.3 2.2-1.3 3.700-2.8 5.200h7c-1.5-1.5-2.5-3-2.8-5.200.5 1 1.800 1.700 3.3 1.700 2.5 0 5-1.5 5-4.5C21 9 12 2 12 2z" /></svg>;
  return <svg {...p}><circle cx="12" cy="7" r="4.6" /><circle cx="6.8" cy="14" r="4.6" /><circle cx="17.2" cy="14" r="4.6" /><path d="M11 13l-1.200 9h4.400L13 13z" /></svg>;
}

const red = (s: Suit) => s === 'hearts' || s === 'diamonds';

/** One playing card: rank, suit, optionally face down. */
export function PlayingCard({ rank, suit, faceDown, className }: PlayingCardProps) {
  return (
    <span className={`ui-playing-cards-card${className ? ` ${className}` : ''}`} data-red={red(suit) || undefined} data-back={faceDown || undefined} role="img" aria-label={faceDown ? 'Face-down card' : label({ rank, suit })}>
      {!faceDown && (
        <>
          <span className="ui-playing-cards-corner" aria-hidden="true"><b>{rank}</b><SuitIcon suit={suit} size={11} /></span>
          <span className="ui-playing-cards-pip" aria-hidden="true"><SuitIcon suit={suit} size={30} /></span>
          <span className="ui-playing-cards-corner ui-playing-cards-corner-b" aria-hidden="true"><b>{rank}</b><SuitIcon suit={suit} size={11} /></span>
        </>
      )}
    </span>
  );
}

const HAND: CardData[] = [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }, { rank: 'Q', suit: 'clubs' }, { rank: 'J', suit: 'diamonds' }, { rank: '10', suit: 'hearts' }];

/** A fanned hand: hover or use the arrow keys to raise a card, click (or Enter/Space) to play it out of the hand. */
export default function PlayingCards({ cards = HAND, spread = 6, onPlay }: PlayingCardsProps) {
  const [hand, setHand] = useState(cards);
  const [table, setTable] = useState<CardData | null>(null);
  const [active, setActive] = useState(-1);
  const [msg, setMsg] = useState('');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = hand.length;
  const mid = (n - 1) / 2;
  const focusAt = (i: number) => { const c = Math.max(0, Math.min(n - 1, i)); setActive(c); refs.current[c]?.focus(); };

  const play = (i: number) => {
    const c = hand[i];
    if (!c) return;
    setHand(hand.filter((_, k) => k !== i));
    setTable(c);
    setActive(-1);
    setMsg(`Played ${label(c)}. ${n - 1} card${n - 1 === 1 ? '' : 's'} left.`);
    onPlay?.(c);
  };
  const key = (e: KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(n - 1); }
  };
  const rest = () => { setHand(cards); setTable(null); setMsg('Cards dealt again.'); };

  return (
    <div className="ui-playing-cards">
      <div className="ui-playing-cards-hand" role="group" aria-label="Your hand" onPointerLeave={() => setActive(-1)}>
        {hand.map((c, i) => {
          const d = i - mid;
          const up = active === i;
          return (
            <button
              key={`${c.rank}${c.suit}`}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              className="ui-playing-cards-slot"
              aria-label={`${label(c)}, ${i + 1} of ${n}. Press to play.`}
              tabIndex={active === i || (active < 0 && i === 0) ? 0 : -1}
              data-up={up || undefined}
              style={{ ['--ui-pc-x' as string]: `${d * 22}px`, ['--ui-pc-r' as string]: `${d * spread}deg`, ['--ui-pc-y' as string]: `${Math.abs(d) * Math.abs(d) * 2}px`, zIndex: up ? 20 : i + 1 }}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onKeyDown={(e) => key(e, i)}
              onClick={() => play(i)}
            >
              <PlayingCard {...c} />
            </button>
          );
        })}
        {n === 0 && <button type="button" className="ui-playing-cards-again" onClick={rest}>Deal again</button>}
      </div>
      <div className="ui-playing-cards-table" aria-hidden={!table}>
        {table ? <PlayingCard key={`${table.rank}${table.suit}`} {...table} className="ui-playing-cards-played" /> : <span className="ui-playing-cards-empty">Play area</span>}
      </div>
      <span className="ui-playing-cards-sr" role="status" aria-live="polite">{msg}</span>
    </div>
  );
}

export function Demo() {
  return <PlayingCards />;
}
