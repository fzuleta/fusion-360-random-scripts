// Utility helpers for using clipper-lib to generate the wheel‑centre offset
// path (and convenient Vector2 helpers).
//
// The module is deliberately standalone so that `wheel.ts` can import just the
// functions it needs without pulling in Three.js types everywhere else.

import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
const { ClipperOffset, JoinType, EndType } = ClipperLib;

// ---------- constants --------------------------------------------------------

/** Scale factor: mm → Clipper int coordinates (1 µm resolution). */
export const SCALE = 1e6;

// ---------- minimal Segment interface ---------------------------------------

export interface Segment {
  type: 'line' | 'arc';
  from: THREE.Vector2;
  to: THREE.Vector2;
  /** Arc centre (only for type==='arc') */
  center?: THREE.Vector2;
  /** True if the arc sweeps CCW, false for CW (same convention as Three.js). */
  anticlockwise?: boolean;
}

// ---------- geometry helpers -------------------------------------------------

/** CCW sweep angle from a→b around centre c (0‥2π, always positive). */
export function angleDiff(
  a: THREE.Vector2,
  b: THREE.Vector2,
  c: THREE.Vector2
): number {
  const θ1 = Math.atan2(a.y - c.y, a.x - c.x);
  const θ2 = Math.atan2(b.y - c.y, b.x - c.x);
  let d = θ2 - θ1;
  if (d < 0) d += 2 * Math.PI;
  return d;
}

/**
 * Convert a list of segments (lines + arcs) into a single closed Clipper path.
 *   • Lines add their end‑point.
 *   • Arcs are flattened using ≤ 5° chord angle (minimum 4 segments).
 */
export function segsToClipperPath(segs: Segment[]): ClipperLib.Path {
  const path: ClipperLib.Path = [];

  for (const seg of segs) {
    if (seg.type === 'line') {
      path.push({
        X: Math.round(seg.to.x * SCALE),
        Y: Math.round(seg.to.y * SCALE),
      });
      continue;
    }

    // ---- arc flattening ----
    const centre = seg.center!;
    const r = centre.distanceTo(seg.from);
    const sweep = seg.anticlockwise
      ? angleDiff(seg.from, seg.to, centre)
      : -angleDiff(seg.to, seg.from, centre); // CW sweep is negative

    const steps = Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 36))); // ≈5°
    const θ0 = Math.atan2(seg.from.y - centre.y, seg.from.x - centre.x);

    for (let i = 1; i <= steps; i++) {
      const θ = θ0 + (sweep * i) / steps;
      const x = centre.x + r * Math.cos(θ);
      const y = centre.y + r * Math.sin(θ);
      path.push({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) });
    }
  }
  return path;
}

/**
 * Offset a Clipper path by +radius (mm).  Positive radius = outward buffer,
 * negative = inward.  Returns the first polygon of the result set.
 */
export function offsetPath(
  path: ClipperLib.Path,
  radiusMM: number
): ClipperLib.Path {
  const co = new ClipperOffset(2 /*arcTolerance*/, 10 /*miterLimit*/);
  co.AddPath(path, JoinType.jtRound, EndType.etClosedPolygon);

  const solution: ClipperLib.Paths = [];
  co.Execute(solution, radiusMM * SCALE);

  return solution[0] ?? [];
}

/** Convert a Clipper path (int coords) back to Vector2[] (mm). */
export function clipperPathToVector2(
  path: ClipperLib.Path
): THREE.Vector2[] {
  return path.map(
    (p) => new THREE.Vector2(p.X / SCALE, p.Y / SCALE)
  );
}

/**
 * Densify a polyline so that the spacing between consecutive points does not
 * exceed `step` (mm).  Does NOT close the path – caller decides if wrap‑around.
 */
export function densify(
  poly: THREE.Vector2[],
  step = 0.1
): THREE.Vector2[] {
  const dense: THREE.Vector2[] = [];

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.ceil(len / step));

    for (let j = 0; j < n; j++) {
      dense.push(a.clone().lerp(b, j / n));
    }
  }
  return dense;
}

// ---------- convenience wrapper ---------------------------------------------

/**
 * Given wheel segments + wheel radius, return a Vector2 polyline representing
 * the *centre* path of the wheel.
 *
 * This is effectively:  centrePath = offset( outline, +wheelRadius )
 */
export function wheelCentrePath(
  segs: Segment[],
  wheelRadius: number
): THREE.Vector2[] {
  const source = segsToClipperPath(segs);
  const buff   = offsetPath(source, wheelRadius);
  return clipperPathToVector2(buff);
}