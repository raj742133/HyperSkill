'use client';

import { useState } from 'react';
import { DownloadLink } from './Download';
import { Figure } from '@/components/fx';

export interface ReleaseCard {
  code: number;
  title: string;
  notes: string;
  meta: string;
  mb: string;
  kind: 'new' | 'improved' | 'fixed' | null;
  href: string;
}

const KINDS = [['all', 'All'], ['new', 'New'], ['improved', 'Improved'], ['fixed', 'Fixed']] as const;
const LABEL = { new: 'New', improved: 'Improved', fixed: 'Fixed' } as const;

/** Every version approved for the home page, newest first, filtered by the kind of change. */
export function Releases({ list, locked, title }: { list: ReleaseCard[]; locked: boolean; title: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>('all');
  const shown = kind === 'all' ? list : list.filter((r) => r.kind === kind);
  const latest = list[0]?.code;

  return (
    <div className="side">
      <div className="side-head rv">
        <p className="lp-kicker">What&apos;s new</p>
        <h2 className="lp-h2">{title}</h2>
        <p className="lp-lead">What changed in each version, with a download for any of them.</p>
        <div className="chips" role="group" aria-label="Filter by kind of change">
          {KINDS.map(([k, t]) => (
            <button key={k} type="button" className={`chip${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{t}</button>
          ))}
        </div>
        <Figure place="releases" />
      </div>
      <div className="rel-list">
        {shown.length === 0 ? <div className="rel-empty">{list.length === 0 ? 'No versions are on the home page yet.' : 'No versions of this kind yet.'}</div> : null}
        {shown.map((r) => (
          <article key={r.code} className="rel">
            <div className="rel-top">
              <h3 className="rel-name">
                {r.title}
                {r.code === latest ? <span className="badge public">Latest</span> : null}
                {r.kind ? <span className="badge">{LABEL[r.kind]}</span> : null}
              </h3>
              <p className="rel-meta">{r.meta}</p>
              <p className={`rel-notes${r.notes ? '' : ' none'}`}>{r.notes || 'No notes for this version.'}</p>
            </div>
            <div className="rel-foot">
              <DownloadLink className="rel-dl" href={r.href} locked={locked}>Download this version <span>· {r.mb}</span></DownloadLink>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
