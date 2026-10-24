import { pieces, plain, type Parts } from './split';

/** Letters appear in order as if typed; a caret blinks after the last one. All css, so it works before any script has loaded. */
export default function Typewriter(p: Parts) {
  return (
    <>
      <span className="fx-sr">{plain(p)}</span>
      <span aria-hidden="true" className="fx-split fx-type">{pieces(p, 'char')}<span className="fx-caret" /></span>
    </>
  );
}
