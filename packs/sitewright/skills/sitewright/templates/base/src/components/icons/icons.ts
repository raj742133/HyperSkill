// The icons this site draws, and the words that stand for icons. Both live in icons.data.json, which is kept in line with your code by
// `npm run icons` (it runs by itself on `npm run dev` and `npm run build`): write <Icon name="rocket" /> and the icon appears.
import data from './icons.data.json';

export const ICONS = data.icons as Record<string, { b: string; w: number; h: number }>;
/** Words that stand for icons: <Icon for="Shipped orders" /> draws the icon that sync-icons chose for that text. */
export const FOR = data.for as Record<string, string>;
/** The set a bare name ("rocket") belongs to: icons.set in src/content/site.json (lucide unless you changed it). */
export const SET = (data as { set?: string }).set ?? 'lucide';
