/** Three layered waves. Each path covers two full periods, so sliding it by half its width loops without a seam. */
const WAVE = 'M0 100 C 240 20 480 20 720 100 S 1200 180 1440 100 C 1680 20 1920 20 2160 100 S 2640 180 2880 100 V200 H0 Z';

export default function Waves() {
  return (
    <div className="fx-bg fx-waves" aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <svg key={n} className={`w${n}`} viewBox="0 0 2880 200" preserveAspectRatio="none"><path d={WAVE} /></svg>
      ))}
    </div>
  );
}
