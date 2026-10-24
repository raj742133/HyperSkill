'use client';

import { useEffect, useRef, useState } from 'react';
import { hexRoad, lengthAtY, lengths, pointAt, toPath, type Pt } from '../brand/route-geometry';

/** The big mark: cell radius (stroke centre), stroke = lane width, and the road's half width. */
const R = 100;
const W = 20;
const HALF = 43;
/** Scrolling that turns the cell, then scrolling that opens it. */
const SPIN = 220;
const OPEN = 140;

interface Geo {
  w: number; h: number;
  mark: null | { cx: number; cy: number; sides: [string, string]; floors: [string, string]; floorLen: number; sideLen: [number, number] };
  cyan: Pt[]; blue: Pt[]; cc: number[]; cb: number[];
  stops: number[]; laneX: number; half: number; lane: number;
  gap: [number, number] | null;
  origin: number; hostTop: number;
}

/** A stop covers both lanes with a little to spare either side. */
const stopW = (g: { half: number; lane: number }) => 2 * g.half + g.lane + (g.lane > 12 ? 22 : 10);
const stopH = (g: { lane: number }) => g.lane + (g.lane > 12 ? 20 : 10);

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The hero's mark and the home page's road, drawn as one picture.
 *
 * The mark is the brand cell - its left side the signal colour, its right side the primary colour - with the
 * lens in the middle. It draws itself in when the page opens. The first stretch of scrolling turns
 * it once, all the way round; the next opens it - the floor folds away - and its two sides carry
 * straight on down as the road, bend in to the middle of the story and run on as its two lanes,
 * filling each stop as they reach it. The stretch through "no signal" is dashed. On a phone there is
 * no mark and the road starts at the story, down the left edge.
 *
 * Layout comes from data attributes: [data-route-logo] (the mark's box), [data-route-lane] (the lane
 * column), [data-route-stop] (each stop, in order), [data-route-start] (where the phone road starts).
 */
export function Route() {
  const wrap = useRef<HTMLDivElement>(null);
  const turn = useRef<SVGGElement>(null);
  const sideL = useRef<SVGPathElement>(null);
  const sideR = useRef<SVGPathElement>(null);
  const floorL = useRef<SVGPathElement>(null);
  const floorR = useRef<SVGPathElement>(null);
  const cyanRef = useRef<SVGPathElement>(null);
  const blueRef = useRef<SVGPathElement>(null);
  const gapRef = useRef<SVGLineElement>(null);
  const capC = useRef<SVGCircleElement>(null);
  const capB = useRef<SVGCircleElement>(null);
  const geoRef = useRef<Geo | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const host = wrap.current?.parentElement;
    if (!host) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const born = performance.now();
    let raf = 0;

    const measure = () => {
      const base = host.getBoundingClientRect();
      const rel = (e: Element) => { const r = e.getBoundingClientRect(); return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; };
      const laneEl = host.querySelector('[data-route-lane]');
      const startEl = host.querySelector('[data-route-start]');
      const logoEl = host.querySelector('[data-route-logo]');
      if (!laneEl || !startEl) return;
      const lane = rel(laneEl);
      const laneX = lane.x + lane.w / 2;
      const stops = Array.from(host.querySelectorAll('[data-route-stop]')).map((e) => { const r = rel(e); return r.y + r.h / 2; });
      if (!stops.length) return;
      const endY = stops[stops.length - 1] - 16;
      const logo = logoEl && getComputedStyle(logoEl).display !== 'none' ? rel(logoEl) : null;

      let g: Geo;
      const common = { w: host.scrollWidth, h: host.scrollHeight, stops, laneX, hostTop: base.top + window.scrollY,
        gap: stops.length >= 3 ? [stops[stops.length - 3] + 26, stops[stops.length - 2] - 26] as [number, number] : null };
      if (logo && logo.w > 100) {
        const cx = logo.x + logo.w / 2, cy = logo.y + logo.h / 2;
        const r = hexRoad(cx, cy, R, laneX, HALF, endY);
        const sl = lengths(r.leftSide), sr = lengths(r.rightSide), fl = lengths(r.leftFloor);
        g = { ...common, cyan: r.cyan, blue: r.blue, cc: lengths(r.cyan), cb: lengths(r.blue), half: HALF, lane: W,
          origin: r.cyan[0][1],
          mark: { cx, cy, sides: [toPath(r.leftSide), toPath(r.rightSide)], floors: [toPath(r.leftFloor), toPath(r.rightFloor)],
            floorLen: fl[fl.length - 1], sideLen: [sl[sl.length - 1], sr[sr.length - 1]] } };
      } else {
        const s = rel(startEl);
        const cyan: Pt[] = [[laneX - 9, s.y], [laneX - 9, endY]];
        const blue: Pt[] = [[laneX + 9, s.y], [laneX + 9, endY]];
        g = { ...common, cyan, blue, cc: lengths(cyan), cb: lengths(blue), half: 9, lane: 10, origin: s.y, mark: null };
      }
      geoRef.current = g;
      setGeo(g);
      requestAnimationFrame(tick);
    };

    const dash = (el: SVGPathElement | null, arr: string) => { if (el) el.style.strokeDasharray = arr; };

    const tick = () => {
      raf = 0;
      const g = geoRef.current;
      const pc = cyanRef.current, pb = blueRef.current;
      if (!g || !pc || !pb) return;
      const s = window.scrollY, vh = window.innerHeight;
      let loading = false;

      if (g.mark) {
        // draw-in: the two sides from the top corner down, then the floor closes from both corners
        const t = still ? 2 : (performance.now() - born - 150) / 1000;
        loading = t < 1.6;
        const sideF = easeInOut(clamp(t / 1.1));
        const floorF = easeInOut(clamp((t - 0.9) / 0.6));
        const [lL, lR] = g.mark.sideLen, fL = g.mark.floorLen;
        dash(sideL.current, `${sideF * lL} ${lL + 1}`);
        dash(sideR.current, `${sideF * lR} ${lR + 1}`);
        // one full turn over the first stretch of scrolling
        const spin = still ? 0 : easeInOut(clamp(s / SPIN)) * 360;
        turn.current?.setAttribute('transform', `rotate(${spin.toFixed(2)} ${g.mark.cx} ${g.mark.cy})`);
        // then the floor folds away towards the bottom corner
        const open = still ? clamp(s / 40) : easeInOut(clamp((s - SPIN) / OPEN));
        const floorVis = open > 0 ? (1 - open) * fL : floorF * fL;
        const floorArr = open > 0 ? `${floorVis} ${fL + 1}` : `0 ${fL - floorVis} ${floorVis} ${fL + 1}`;
        dash(floorL.current, floorArr); dash(floorR.current, floorArr);
        for (const f of [floorL.current, floorR.current]) if (f) f.style.opacity = floorVis < 1 ? '0' : '1';
      }

      // the road's leading edge (host coordinates): with a mark it waits for the cell to turn, comes
      // out as it opens and catches up until the tip rides 62% down the screen
      const steady = s + vh * 0.62 - g.hostTop;
      const edge = g.mark ? Math.min(g.origin + Math.max(0, s - SPIN - OPEN * 0.3) * 1.8, steady) : steady;
      const lc = lengthAtY(g.cyan, g.cc, 0, edge), lb = lengthAtY(g.blue, g.cb, 0, edge);
      const Lc = g.cc[g.cc.length - 1], Lb = g.cb[g.cb.length - 1];
      dash(pc, `${lc} ${Lc + 1}`); dash(pb, `${lb} ${Lb + 1}`);
      pc.style.opacity = lc > 0.5 ? '1' : '0';
      pb.style.opacity = lb > 0.5 ? '1' : '0';
      const ec = pointAt(g.cyan, g.cc, lc), eb = pointAt(g.blue, g.cb, lb);
      for (const [ref, e, l] of [[capC, ec, lc], [capB, eb, lb]] as const) {
        ref.current?.setAttribute('cx', String(e[0]));
        ref.current?.setAttribute('cy', String(e[1]));
        ref.current?.setAttribute('opacity', l > 40 ? '1' : '0');
      }
      const front = Math.min(ec[1], eb[1]);
      if (gapRef.current && g.gap) gapRef.current.setAttribute('y2', String(Math.max(g.gap[0], Math.min(g.gap[1], front - 12))));
      const n = lc > 40 ? g.stops.filter((t) => front >= t - 24).length : 0;
      setReached(n);
      window.dispatchEvent(new CustomEvent('route:reached', { detail: n }));
      if (loading) raf = requestAnimationFrame(tick);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(host);
    document.fonts?.ready.then(measure).catch(() => undefined);
    window.addEventListener('scroll', on, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="route" ref={wrap} aria-hidden="true">
      {geo ? (
        <svg width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`}>
          <path ref={blueRef} d={toPath(geo.blue)} className="route-o" strokeWidth={geo.lane} style={{ opacity: 0 }} />
          <path ref={cyanRef} d={toPath(geo.cyan)} className="route-i" strokeWidth={geo.lane} style={{ opacity: 0 }} />
          {geo.gap ? <line ref={gapRef} className="route-gap" x1={geo.laneX - geo.half} x2={geo.laneX - geo.half} y1={geo.gap[0]} y2={geo.gap[0]} strokeWidth={geo.lane + 2} /> : null}
          {geo.mark ? (
            <g className="route-mark">
              <g ref={turn}>
                <path ref={floorL} d={geo.mark.floors[0]} className="route-i" strokeWidth={W} style={{ strokeDasharray: '0 1e5' }} />
                <path ref={floorR} d={geo.mark.floors[1]} className="route-o" strokeWidth={W} style={{ strokeDasharray: '0 1e5' }} />
                <path ref={sideL} d={geo.mark.sides[0]} className="route-i" strokeWidth={W} style={{ strokeDasharray: '0 1e5' }} />
                <path ref={sideR} d={geo.mark.sides[1]} className="route-o" strokeWidth={W} style={{ strokeDasharray: '0 1e5' }} />
              </g>
              <circle className="route-lens" cx={geo.mark.cx} cy={geo.mark.cy} r={32} />
            </g>
          ) : null}
          <circle ref={capB} className="route-cap" r={geo.lane > 12 ? 3 : 2} opacity={0} />
          <circle ref={capC} className="route-cap" r={geo.lane > 12 ? 3 : 2} opacity={0} />
        </svg>
      ) : null}
      {geo?.stops.map((t, i) => (
        // Each stop lies across both lanes, as on the RCS9 site: the road runs through it.
        <span key={i} className={`stop${i < reached ? ' on' : ''}${i === geo.stops.length - 1 ? ' last' : ''}`}
          style={{ top: t, left: geo.laneX, width: stopW(geo), height: stopH(geo), marginLeft: -stopW(geo) / 2, marginTop: -stopH(geo) / 2 }} />
      ))}
    </div>
  );
}
