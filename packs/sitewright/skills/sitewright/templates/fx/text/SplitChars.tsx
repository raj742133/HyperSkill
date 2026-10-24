import { pieces, plain, type Parts } from './split';

/** Letters rise into place one after another. The plain text stays in the DOM for screen readers and search engines. */
export default function SplitChars(p: Parts) {
  return (
    <>
      <span className="fx-sr">{plain(p)}</span>
      <span aria-hidden="true" className="fx-split fx-chars">{pieces(p, 'char')}</span>
    </>
  );
}
