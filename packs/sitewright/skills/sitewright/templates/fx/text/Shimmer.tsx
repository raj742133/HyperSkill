import type { Parts } from './split';

/** A band of light sweeps across the headline. The accent keeps its brand colour and gets its own, brighter sweep. */
export default function Shimmer({ before, accent, after }: Parts) {
  if (!accent) return <span className="fx-shim">{before}</span>;
  return <><span className="fx-shim">{before}</span><em className="fx-shim fx-shim-acc">{accent}</em><span className="fx-shim">{after}</span></>;
}
