'use client';
import { useEffect, useState } from 'react';
import { useReducedMotion } from './_n1';

export interface AiStateLoadingProps {
  steps?: string[];
  /** index of the active step; steps.length means everything is done. Leave out to autoplay. */
  currentStep?: number;
  autoplay?: boolean;
  interval?: number;
  loop?: boolean;
  title?: string;
  className?: string;
}

const DEFAULT_STEPS = ['Reading', 'Planning', 'Building', 'Checking'];

export default function AiStateLoading({ steps = DEFAULT_STEPS, currentStep, autoplay, interval = 1500, loop = true, title = 'Working through it', className = '' }: AiStateLoadingProps) {
  const reduced = useReducedMotion();
  const auto = autoplay ?? currentStep === undefined;
  const [tick, setTick] = useState(0);
  const total = steps.length;

  useEffect(() => {
    if (!auto || currentStep !== undefined) return;
    if (reduced) { setTick(total); return; }
    if (tick >= total && !loop) return;
    const t = setTimeout(() => setTick((v) => (v >= total ? 0 : v + 1)), tick >= total ? 2400 : interval);
    return () => clearTimeout(t);
  }, [auto, currentStep, reduced, tick, total, loop, interval]);

  const cur = Math.max(0, Math.min(total, currentStep ?? (auto ? tick : 0)));
  const finished = cur >= total;
  const live = finished ? 'Finished all steps' : `Step ${cur + 1} of ${total}: ${steps[cur]}`;

  return (
    <div className={`ui-ai-state-loading ${className}`.trim()} data-done={finished || undefined}>
      <p className="ui-ai-state-loading-title">{finished ? 'All steps finished' : title}</p>
      <ol className="ui-ai-state-loading-list">
        {steps.map((s, i) => {
          const st = i < cur ? 'done' : i === cur ? 'active' : 'pending';
          return (
            <li key={s + i} data-state={st} aria-current={st === 'active' ? 'step' : undefined}>
              <svg className="ui-ai-state-loading-icon" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none">
                {st === 'done' && (<><circle cx="10" cy="10" r="9" fill="var(--ok, #16a34a)" /><path d="M5.8 10.3l2.8 2.8 5.6-5.8" stroke="var(--on-primary, #fff)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></>)}
                {st === 'active' && (<><circle cx="10" cy="10" r="8" stroke="var(--line-strong, #bbb)" strokeWidth="2" /><circle className="ui-ai-state-loading-arc" cx="10" cy="10" r="8" stroke="var(--primary, #2563eb)" strokeWidth="2" strokeLinecap="round" strokeDasharray="12 40" /></>)}
                {st === 'pending' && <circle cx="10" cy="10" r="8" stroke="var(--line-strong, #bbb)" strokeWidth="2" strokeDasharray="2 3.2" />}
              </svg>
              <span className="ui-ai-state-loading-label">{s}</span>
              <span className="ui-ai-state-loading-sr">{st === 'done' ? ', done' : st === 'active' ? ', in progress' : ', waiting'}</span>
            </li>
          );
        })}
      </ol>
      <span className="ui-ai-state-loading-sr" role="status" aria-live="polite" aria-atomic="true">{live}</span>
    </div>
  );
}

export function Demo() {
  return <div style={{ padding: '8px 16px' }}><AiStateLoading /></div>;
}
