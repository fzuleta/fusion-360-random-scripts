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

  for (const seg of segments) {
    if (seg.kind !== 'cut' || seg.pts.length < minPts) {
      out.push(seg);
      continue;
    }

    const pts = seg.pts;
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
        const err = slice.reduce((m, p) => Math.max(m, Math.abs(Math.hypot(p.x - Xc, p.y - Yc) - R)), 0);

        if (err > tol) break;                // too far – stop growing
        cx = Xc; cy = Yc; r = R; ok = true;
        j++;
      }
      if (ok && j - i >= minPts) {
        const start  = pts[i];
        const end    = pts[j - 1];
        const cross  = (start.x - cx)*(end.y - cy) - (start.y - cy)*(end.x - cx);
        cw = cross < 0;                      // CW if negative (right‑handed coord)

        out.push({
          kind: 'arc',
          pts: [start, end],
          feed: seg.feed,
          arc: { cw, cx, cy, r },
        });
        i = j - 1;                           // resume after this arc
      } else {
        // couldn't fit – emit as line
        out.push({
          kind: 'cut',
          pts: [pts[i], pts[i+1]],
          feed: seg.feed,
        });
        i++;
      }
    }
    // copy any tail points (last 20%)
    for (; i < pts.length - 1; i++) {
      out.push({ kind: 'cut', pts: [pts[i], pts[i + 1]], feed: seg.feed });
    }
  }
  return out;
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