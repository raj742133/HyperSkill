import type { Parts } from './split';

/** No headline animation: the words, with the accent in an <em> so it takes the brand colour. */
export default function Plain({ before, accent, after }: Parts) {
  return <>{before}{accent ? <em>{accent}</em> : null}{after}</>;
}
