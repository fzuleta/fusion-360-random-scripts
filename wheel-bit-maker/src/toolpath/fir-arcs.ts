import type { ToolpathSegment } from "./morph-lines";

/**
 * Collapse nearly‑circular subsequences of CUT segments into ARC segments.
 * @param tol      max orthogonal error (mm)
 * @param minPts   min # points to attempt an arc
 * @param arcFrac  0‑1: fraction of total arc length to convert (e.g. 0.8 = first 80%)
 */
export function fitArcsInSegments(
  segments: ToolpathSegment[],
  { tol = 0.002, minPts = 6, arcFrac = 0.8 } = {},
): ToolpathSegment[] {
  const out: ToolpathSegment[] = [];

  const flushCutRun = (run: ToolpathSegment[]) => {
    if (run.length === 0) return;
    out.push(...fitArcsInCutRun(run, { tol, minPts, arcFrac }));
    run.length = 0;
  };

  const cutRun: ToolpathSegment[] = [];

  for (const seg of segments) {
    const prev = cutRun[cutRun.length - 1];
    const isContiguousCut =
      seg.kind === 'cut' &&
      seg.pts.length >= 2 &&
      (
        !prev ||
        (
          prev.kind === 'cut' &&
          samePoint(prev.pts[prev.pts.length - 1], seg.pts[0]) &&
          prev.feed === seg.feed
        )
      );

    if (isContiguousCut) {
      cutRun.push(seg);
      continue;
    }

    flushCutRun(cutRun);

    if (seg.kind !== 'cut') {
      out.push(seg);
      continue;
    }

    cutRun.push(seg);
  }

  flushCutRun(cutRun);
  return out;
}

function fitArcsInCutRun(
  run: ToolpathSegment[],
  { tol, minPts, arcFrac }: { tol: number; minPts: number; arcFrac: number }
): ToolpathSegment[] {
  if (run.length === 0) return [];

  const feed = run[0].feed;
  const pts: PointXYZ[] = [run[0].pts[0]];
  run.forEach(seg => {
    pts.push(seg.pts[seg.pts.length - 1]);
  });

  if (pts.length < minPts) {
    return run;
  }

  const out: ToolpathSegment[] = [];
  const nFit = Math.floor((pts.length - 1) * arcFrac);

  let i = 0;
  while (i < nFit - (minPts - 1)) {
    // --- 1.  try grow an arc starting at i -------------------------
    let j = i + 2;                         // need at least 3 points
    let ok = false;
    let cx = 0, cy = 0, r = 0, cw = false;

    while (j < nFit + 1) {
      const slice = pts.slice(i, j + 1);
      const fit = fitCircle(slice);        // LSQ circle fit (see helper below)
      if (!fit) break;
      const { x: Xc, y: Yc, r: R } = fit;

      // max orthogonal residual 
      const errXY = slice.reduce((m, p) =>
        Math.max(m, Math.abs(Math.hypot(p.x - Xc, p.y - Yc) - R)), 0);
      
      // Also check Z linearity for helix
      const z0 = slice[0].z, zN = slice[slice.length - 1].z;
      const dz = zN - z0;
      const errZ = slice.reduce((m, p, k) => {
        const t = k / (slice.length - 1);
        return Math.max(m, Math.abs((z0 + dz * t) - p.z));
      }, 0);
      
      if (errXY > tol || errZ > tol) break; 
      
      cx = Xc; cy = Yc; r = R; ok = true;
      j++;
    }
    if (ok && j - i >= minPts) {
      const start  = pts[i];
      const end    = pts[j - 1];
      const slice = pts.slice(i, j);

      if (isNearLinearSlice(slice, tol, r)) {
        out.push({
          kind: 'cut',
          pts: [pts[i], pts[i + 1]],
          feed,
        });
        i++;
        continue;
      }

      const cross  = (start.x - cx)*(end.y - cy) - (start.y - cy)*(end.x - cx);
      cw = cross < 0;                      // CW if negative (right‑handed coord)

      out.push({
        kind: 'arc',
        pts: [start, end],
        feed,
        arc: { cw, cx, cy, r },
      });
      i = j - 1;                           // resume after this arc
    } else {
      // couldn't fit – emit as line
      out.push({
        kind: 'cut',
        pts: [pts[i], pts[i+1]],
        feed,
      });
      i++;
    }
  }

  // copy any tail points (last 20%)
  for (; i < pts.length - 1; i++) {
    out.push({ kind: 'cut', pts: [pts[i], pts[i + 1]], feed });
  }

  return out;
}

function samePoint(a: PointXYZ, b: PointXYZ): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function isNearLinearSlice(pts: PointXYZ[], tol: number, radius: number): boolean {
  if (pts.length < 3) return true;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);

  if (chord <= tol) return true;

  const lineDeviation = pts.slice(1, -1).reduce((max, p) => {
    const numer = Math.abs(dy * p.x - dx * p.y + end.x * start.y - end.y * start.x);
    return Math.max(max, numer / chord);
  }, 0);

  if (lineDeviation <= tol) return true;

  if (radius <= 0 || !Number.isFinite(radius)) return true;

  const halfChord = chord / 2;
  if (radius <= halfChord) return false;

  const sagitta = radius - Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  return sagitta <= tol;
}

/* --- very small helper: Kasa circle fit --------------------------- */
function fitCircle(pts: PointXYZ[]): { x: number; y: number; r: number } | null {
  const m = pts.length;
  if (m < 3) return null;
  let sx=0, sy=0, sxx=0, syy=0, sxy=0, sx3=0, sy3=0, sx2y=0, sxy2=0;

  for (const p of pts) {
    const { x, y } = p;
    const x2 = x*x, y2 = y*y;
    sx += x; sy += y;
    sxx += x2; syy += y2; sxy += x*y;
    sx3 += x2*x; sy3 += y2*y;
    sx2y += x2*y; sxy2 += x*y2;
  }
  const C = m*sxx - sx*sx;
  const D = m*sxy - sx*sy;
  const E = m*syy - sy*sy;
  const G = 0.5*(m*(sx2y + sy3) - sx*syy - sy*sxy);
  const H = 0.5*(m*(sx3 + sxy2) - sx*sxy - sy*sxx);

  const denom = C*E - D*D;
  if (Math.abs(denom) < 1e-9) return null;   // degenerates
  const cx = (E*H - D*G) / denom;
  const cy = (C*G - D*H) / denom;
  const r  = Math.sqrt((sxx + syy - 2*cx*sx - 2*cy*sy + m*(cx*cx + cy*cy)) / m);
  return { x: cx, y: cy, r };
}