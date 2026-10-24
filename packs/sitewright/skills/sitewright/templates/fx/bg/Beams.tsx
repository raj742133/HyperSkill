/** Vertical beams of light sweeping down. Positions and timings are fixed, so the server and browser render the same thing. */
const BEAMS = [6, 17, 29, 41, 52, 63, 75, 87, 95];

export default function Beams() {
  return (
    <div className="fx-bg fx-beams" aria-hidden="true">
      {BEAMS.map((left, i) => (
        <i key={left} style={{ left: `${left}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${7 + (i % 4) * 1.6}s` }} />
      ))}
    </div>
  );
}
