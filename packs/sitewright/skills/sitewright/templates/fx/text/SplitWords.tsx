import { pieces, type Parts } from './split';

/** Words slide up out of a mask, one after another. */
export default function SplitWords(p: Parts) {
  return <span className="fx-split fx-words">{pieces(p, 'word')}</span>;
}
