/**
 * A small (i) that explains the thing next to it, on hover or keyboard focus - so a number or a
 * term on the dashboard never has to be guessed. No JavaScript: CSS shows the bubble.
 */
export function Hint({ text, label }: { text: string; label?: string }) {
  return (
    <span className="hint" tabIndex={0} role="note" aria-label={label ? `${label}: ${text}` : text}>
      <span aria-hidden="true">i</span>
      <span className="hint-bubble" aria-hidden="true">{text}</span>
    </span>
  );
}
