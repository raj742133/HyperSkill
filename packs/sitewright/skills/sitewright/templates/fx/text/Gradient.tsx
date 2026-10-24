import type { Parts } from './split';

/** The accent word flows through the brand colours. Without an accent the whole headline does. */
export default function Gradient({ before, accent, after }: Parts) {
  if (!accent) return <span className="fx-grad">{before}</span>;
  return <>{before}<em className="fx-grad">{accent}</em>{after}</>;
}
