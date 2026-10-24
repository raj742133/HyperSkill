import { FOR, ICONS, SET } from './icons';

/**
 * One icon, drawn inline in the colour of the text around it (currentColor) and 1em high, so it follows the font size, the theme
 * and a hover state with no extra css.
 *
 *   <Icon name="rocket" />              an icon of the site's set; "tabler:home" picks a set; "custom:bean" is one of your own
 *   <Icon for="Shipped orders" />       the icon that fits these words (your icons.map first, then the built-in words)
 *
 * Just write it. The icon is brought into icons.data.json by `npm run dev` / `npm run build` (or `npm run icons`); nothing else to do.
 * An empty or unknown name draws nothing, so a place without an icon keeps its default look.
 */
export function Icon({ name, for: text, className }: { name?: string | null; for?: string; className?: string }) {
  const id = name || (text ? FOR[text.toLowerCase().trim()] : undefined);
  const key = id ? (id.includes(':') ? id : `${SET}:${id}`) : undefined;
  const icon = key ? ICONS[key] : undefined;
  if (!icon) return null;
  return (
    <svg
      className={`ic${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${icon.w} ${icon.h}`}
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      data-icon={key}
      dangerouslySetInnerHTML={{ __html: icon.b }}
    />
  );
}
