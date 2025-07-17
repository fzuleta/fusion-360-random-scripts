import * as THREE from 'three';

import { morphLinesAdaptive, planSegmentsFromPasses, type ToolpathSegment } from '../../toolpath/morph-lines';
import { fitArcsInSegments } from '../../toolpath/fir-arcs';


export const generatePath = (props: {  
  stepOver: number, 
  lineStart: PointXYZ[], 
  lineA: PointXYZ[], 
  lineB: PointXYZ[],
  lineB_offset: PointXYZ[];
  stockRadius: number;
  bit: IBit;
  feedRate: number;
  cutZ: number;
}) => {
  const { stepOver, lineA, lineB_offset, stockRadius, bit, feedRate, cutZ } = props;
  const originalLines: PointXYZ[][] = [props.lineStart, props.lineA, props.lineB];
  const morphedLines = morphLinesAdaptive({ lineA, lineB: lineB_offset, stepOver, maxSeg: stepOver });
  
  const segmentsRaw = planSegmentsFromPasses({
    passes: morphedLines,
    safeY: stockRadius + bit.diameter / 2 + 2, // 2 mm clearance
    cutZ,                               // -0.5 demo depth
    stepOver,
    baseFeed: feedRate,
    plungeFeed: feedRate * 0.4,
  }); 
  const segmentsForGcodeFitted = fitArcsInSegments(segmentsRaw, {
    tol: 0.05,      // increase tolerance to allow more deviation
    minPts: 3,      // allow fitting arcs to 3 points instead of 4+
    arcFrac: 1      // keep this as-is to allow full-pass fitting
  });
  console.log("cut:", segmentsRaw.filter(s => s.kind === 'cut').length);
  console.log("arc:", segmentsForGcodeFitted.filter(s => s.kind === 'arc').length);
  return {
    originalLines,
    morphedLines,
    segmentsForThreeJs: segmentsToVectorPath(segmentsForGcodeFitted, 1.5), // for THREE to draw
    segmentsForGcodeFitted, // for GCODE to export
  }
}

export const convertLinesToVector3s = (line: PointXYZ[]) => {
  const path: THREE.Vector3[] = [];
  for (const p of line) {
    path.push(new THREE.Vector3(p.x, p.y, p.z));
  }
  return path;
}

export function buildRasterPath(
  posList: PointXYZ[][],
  yOffset: number,
): TVector3[] {
  const path: THREE.Vector3[] = [];

  for (let i = 0; i < posList.length; i++) {
    const line = posList[i];
    if (!line || line.length === 0) continue;

    // ── 1) cut along the line itself ────────────────────────────────
    for (const p of line) {
      const pt: TVector3 = new THREE.Vector3(p.x, p.y, p.z);
      pt.isCut=true
      path.push(pt);
    }

    // ── 2) retract up after the last point ──────────────────────────
    const last = line[0];
    const retractY = last.y + yOffset;
    const retractA: TVector3 = new THREE.Vector3(last.x, retractY, last.z);
    retractA.isRetract = true;
    path.push(retractA);

    // ── 3) traverse over to the next line's start (still retracted) ─
    if (i + 1 < posList.length) {
      const nextFirst = posList[i + 1][0];

      // traverse over at retract height
      const retractB: TVector3 = new THREE.Vector3(nextFirst.x, retractY, nextFirst.z);
      retractB.isRetract = true;
      path.push(retractB);

      // descent back down: mark as cutting move
      const descent: TVector3 = new THREE.Vector3(nextFirst.x, nextFirst.y, nextFirst.z);
      descent.isCut = true;
      path.push(descent);
    }
  }

  // ── 4) strip consecutive duplicates / zero-length hops ──────────────
  const dedup: TVector3[] = [];
  for (const p of path) {
    if (
      dedup.length === 0 ||
      !dedup[dedup.length - 1].equals(p)
    ) {
      dedup.push(p);
    }
  }

  return dedup;
}


export function segmentsToVectorPath(
  segs: ToolpathSegment[],
  arcRes = 0.2         // mm chord height for arc tessellation
): TVector3[] {
  const out: TVector3[] = [];

  const push = (v: THREE.Vector3, kind: 'cut'|'retract'|'rapid'|'arc') => {
    (v as TVector3).isCut      = kind === 'cut';
    (v as TVector3).isRetract  = kind === 'retract';
    (v as TVector3).isRapid    = kind === 'rapid';
    (v as TVector3).isArc      = kind === 'arc';
    out.push(v as TVector3);
  };

  for (const s of segs) {
    switch (s.kind) {
      case 'rapid':
      case 'plunge':
      case 'retract':
      case 'cut':
        s.pts.forEach(p =>
          push(new THREE.Vector3(p.x, p.y, p.z), 
               s.kind === 'cut' ? 'cut' : 'retract')
        );
        break;
      case 'arc': {
        const [a, b] = s.pts;
        const { cx, cy, r, cw } = s.arc!;
        const a0 = Math.atan2(a.y - cy, a.x - cx);
        const a1 = Math.atan2(b.y - cy, b.x - cx);
        const span = cw
          ? (a0 > a1 ? a0 - a1 : a0 - a1 + 2 * Math.PI)
          : (a1 > a0 ? a1 - a0 : a1 - a0 + 2 * Math.PI);
        // const steps = Math.max(2, Math.ceil(r * span / arcRes));
        const steps = Math.min(200, Math.max(2, Math.ceil(r * span / arcRes)));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const ang = cw ? a0 - span * t : a0 + span * t;
          const z = a.z + (b.z - a.z) * t;
          push(new THREE.Vector3(cx + r * Math.cos(ang), cy + r * Math.sin(ang), z), 'cut');
        }
        break;
      }
    }
  }
  // remove duplicates
  return out.filter((p,i,arr)=> i===0 || !p.equals(arr[i-1]));
}