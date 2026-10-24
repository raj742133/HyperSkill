import { pieces, type Parts } from './split';

/** Words sharpen from a soft blur, one after another. */
export default function BlurIn(p: Parts) {
  return <span className="fx-split fx-blurin">{pieces(p, 'word')}</span>;
}
