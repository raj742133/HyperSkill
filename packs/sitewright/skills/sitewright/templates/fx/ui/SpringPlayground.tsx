'use client';
import { useId, useMemo, useState } from 'react';
import { SPRING_PRESETS, springPath, useSpring, type SpringConfig } from './_m1';

export interface SpringPlaygroundProps {
  /** starting values */
  initial?: SpringConfig;
  className?: string;
}

const RANGES = [
  { key: 'stiffness', label: 'Stiffness', min: 20, max: 800, step: 10 },
  { key: 'damping', label: 'Damping', min: 1, max: 80, step: 1 },
  { key: 'mass', label: 'Mass', min: 0.2, max: 5, step: 0.1 },
] as const;

export default function SpringPlayground({ initial = SPRING_PRESETS.bouncy, className }: SpringPlaygroundProps) {
  const id = useId();
  const [cfg, setCfg] = useState<SpringConfig>({ stiffness: initial.stiffness, damping: initial.damping, mass: initial.mass });
  const [on, setOn] = useState(false);
  const x = useSpring(on ? 1 : 0, cfg, false);
  const curve = useMemo(() => springPath(cfg, { width: 200, height: 70, duration: 2 }), [cfg]);
  const settle = curve.settle >= 10 ? '10 s+' : `${curve.settle.toFixed(2)} s`;
  return (
    <div className={`ui-spring-playground-root${className ? ' ' + className : ''}`}>
      <div className="ui-spring-playground-top">
        <div className="ui-spring-playground-presets" role="group" aria-label="Presets">
          {(Object.keys(SPRING_PRESETS) as (keyof typeof SPRING_PRESETS)[]).map((k) => (
            <button key={k} type="button" className="ui-spring-playground-chip" onClick={() => setCfg({ ...SPRING_PRESETS[k] })}>
              {k}
            </button>
          ))}
        </div>
        <button type="button" className="ui-spring-playground-play" onClick={() => setOn((v) => !v)}>
          Play
        </button>
      </div>
      <div className="ui-spring-playground-body">
        <div className="ui-spring-playground-sliders">
          {RANGES.map((r) => (
            <label key={r.key} className="ui-spring-playground-row" htmlFor={`${id}-${r.key}`}>
              <span className="ui-spring-playground-lab">{r.label}</span>
              <input
                id={`${id}-${r.key}`}
                type="range"
                min={r.min}
                max={r.max}
                step={r.step}
                value={cfg[r.key]}
                onChange={(e) => setCfg((c) => ({ ...c, [r.key]: Number(e.target.value) }))}
              />
              <output className="ui-spring-playground-val">{r.key === 'mass' ? cfg.mass.toFixed(1) : cfg[r.key]}</output>
            </label>
          ))}
        </div>
        <div className="ui-spring-playground-viz">
          <svg viewBox="0 0 200 70" role="img" aria-label={`Spring response curve, settles in ${settle}`} className="ui-spring-playground-svg">
            <line x1="4" x2="196" y1={curve.targetY} y2={curve.targetY} className="ui-spring-playground-target" />
            <path d={curve.d} className="ui-spring-playground-curve" fill="none" />
          </svg>
          <div className="ui-spring-playground-track" aria-hidden="true">
            <span className="ui-spring-playground-ball" style={{ left: `calc(${x * 100}% - ${x * 16}px)` }} />
          </div>
          <p className="ui-spring-playground-settle" aria-live="polite">Settles in <b>{settle}</b></p>
        </div>
      </div>
    </div>
  );
}

export function Demo() {
  return <SpringPlayground />;
}
