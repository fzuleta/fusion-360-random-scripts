import * as THREE from 'three';

import { morphLinesAdaptive, planSegmentsFromPasses, type ToolpathSegment } from '../../toolpath/morph-lines';
import { fitArcsInSegments } from '../../toolpath/fir-arcs';

export const generatePath = (props: {
  stepOver: number;
  stepOverIsMM?: boolean;                      // true => stepOver is mm; false => fraction of D
  lineA: PointXYZ[];
  lineB: PointXYZ[];
  stockRadius: number;
  bit: IBit;
  feedRate: number;                            // manufacturer feed (mm/min)
  cutZ: number;
  passDirection?: 'top-to-bottom' | 'bottom-to-top';
  alongMaxSegMM?: number;                      // along-path tessellation target (mm)
  arcResMM?: number;                           // THREE tessellation chord height (mm)
  arcTolMM?: number;                           // arc-fitting tolerance (mm)
}) => {
  const {
    stepOver, stepOverIsMM = false,
    lineA, lineB, stockRadius, bit, feedRate, cutZ,
    passDirection = 'top-to-bottom',
    alongMaxSegMM, arcResMM, arcTolMM,
  } = props;

  // Explicit step-over handling (mm vs %D)
  const stepOverMM = stepOverIsMM ? stepOver : stepOver * bit.diameter;

  // Along-path density independent of radial step-over
  const maxSegAlong = alongMaxSegMM ?? Math.min(0.20, stepOverMM);

  const morphedLines = morphLinesAdaptive({
    lineA, lineB,
    stepOver: stepOverMM,
    maxSeg: maxSegAlong,
    maxIter: 100000,
  });

  const passesForMachining =
    passDirection === 'bottom-to-top' ? [...morphedLines].reverse() : morphedLines;

  const clearance = stockRadius + bit.diameter / 2 + 2;
  const safeY = passDirection === 'bottom-to-top' ? -clearance : clearance;

  // Build segments
  const segmentsRaw = planSegmentsFromPasses({
    passes: passesForMachining,
    safeY,
    cutZ, 
    baseFeed: feedRate,
    plungeFeed: Math.max(1, feedRate * 0.4),
  });

  // Normalize feeds: constant during cutting (use manufacturer feed)
  for (const s of segmentsRaw) {
    if (s.kind === 'cut') s.feed = feedRate;
  }

  // Fit arcs with a sensible tolerance (tighter if micro step-over)
  const fitted = fitArcsInSegments(segmentsRaw, {
    tol: arcTolMM ?? (stepOverMM <= 0.05 ? 0.01 : 0.02),
    minPts: 3,
    arcFrac: 1,
  });

  return {
    originalLines: [lineA, lineB],
    morphedLines,
    segmentsForThreeJs: segmentsToVectorPath(
      fitted,
      arcResMM ?? Math.min(0.20, maxSegAlong)
    ),
    segmentsForGcodeFitted: fitted,
  };
};

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
        s.pts.forEach(p => push(new THREE.Vector3(p.x, p.y, p.z), 'rapid'));
        break;
      case 'plunge':
      case 'retract':
        s.pts.forEach(p => push(new THREE.Vector3(p.x, p.y, p.z), 'retract'));
        break;
      case 'cut':
        s.pts.forEach(p => push(new THREE.Vector3(p.x, p.y, p.z), 'cut'));
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

/**
 * Insert intermediate points so that no segment is longer than `maxSeg` (mm).
 * This is purely for visual smoothness; the extra points are NOT sent to the
 * G‑code exporter.
 */
export function densifyPath(
  path: TVector3[],
  maxSeg = 0.2   // mm
): TVector3[] {
  if (path.length < 2) return path.slice();
  const out: TVector3[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dist = a.distanceTo(b);
    const steps = Math.max(1, Math.ceil(dist / maxSeg));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const p = a.clone().lerp(b, t) as TVector3;
      // copy semantic flags only for the final point of the segment so
      // animation colour coding still works.
      if (k === steps) {
        p.isCut     = b.isCut;
        p.isRetract = b.isRetract;
        p.isRapid   = b.isRapid;
        p.isArc     = b.isArc;
      } else {
        p.isCut = a.isCut;  // treat mids as the same kind as segment start
      }
      out.push(p);
    }
  }
  return out;
}

/**
 * Convert a display‑path (TVector3[]) into raw ToolpathSegment[]
 * preserving cut / retract / rapid semantics for the G‑code exporter.
 */
export function pathToSegments(
  path: TVector3[],
  opts?: { baseFeed?: number; stepOverMM?: number; minFeedFrac?: number }
): ToolpathSegment[] {
  const baseFeed    = opts?.baseFeed; 

  const segs: ToolpathSegment[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (a.equals(b)) continue;

    const isCut = !!(a as any).isCut;
    const kind: ToolpathSegment['kind'] = isCut ? 'cut' : 'rapid'; // retracts/rapids both → G0

    const seg: ToolpathSegment = {
      kind,
      pts: [
        { x: a.x, y: a.y, z: a.z },
        { x: b.x, y: b.y, z: b.z },
      ],
    };

     if (kind === 'cut' && baseFeed !== undefined) {
      seg.feed = Math.max(1, baseFeed);  // constant feed during cutting
    }
    segs.push(seg);
  }
  return segs;
}

/**
 * Feed a raster path through the same preview / G‑code pipeline that
 * `generatePath` uses for the first passes.
 */
export const generateToothPath = (
  path: TVector3[],
  opts: {
    baseFeed: number;                          // manufacturer feed (mm/min)
    stepOver: number;                          // mm or %D (see flag)
    bitDiameter: number;
    stepOverIsMM?: boolean;                    // true => stepOver is mm
    alongMaxSegMM?: number;                    // along-path tessellation target (mm)
    arcResMM?: number;                         // THREE tessellation chord height (mm)
    arcTolMM?: number;                         // arc-fitting tolerance (mm)
  }
) => {
  const stepOverMM = opts.stepOverIsMM ? opts.stepOver : opts.stepOver * opts.bitDiameter;
  const maxSegAlong = opts.alongMaxSegMM ?? Math.min(0.20, stepOverMM);

  // Densify preview path; convert to segments without dy-based throttling
  const raw = pathToSegments(densifyPath(path, maxSegAlong), {
    baseFeed: opts.baseFeed,                   // do NOT pass stepOverMM here (avoids dy-scaling)
  });

  // Constant feed during cutting
  for (const s of raw) {
    if (s.kind === 'cut') s.feed = Math.max(1, opts.baseFeed);
  }

  const fitted = fitArcsInSegments(raw, {
    tol: opts.arcTolMM ?? (stepOverMM <= 0.05 ? 0.01 : 0.02),
    minPts: 3,
    arcFrac: 1,
  });

  const segmentsForThreeJs = segmentsToVectorPath(
    fitted,
    opts.arcResMM ?? Math.min(0.20, maxSegAlong)
  );

  return { segmentsForThreeJs, segmentsForGcodeFitted: fitted };
};


export const createBitMesh = (bit: IBit) => {
  // MeshBasicMaterial ignores lights → looks flat.
  // Switch to a PBR‑style material so the cylinder reacts to the Ambient
  // and Directional lights already in the scene.
  const bitMaterial = new THREE.MeshStandardMaterial({
    color: 0x8e98b3,       // same hue
    metalness: 0.7,        // slight metallic sheen
    roughness: 0.3,        // enough gloss to catch highlights
    side: THREE.DoubleSide // keep both faces visible if needed
  });
  const bitGeometru = new THREE.CylinderGeometry(
    bit.diameter / 2,   // radiusTop
    bit.diameter / 2,   // radiusBottom
    bit.height,         // height (along local +Y)
    32                  // radial segments
  );

  // Shift the geometry down so its *bottom* face sits at the local origin.
  // (Mesh is later placed with position.y = 0 so the wheel rests on the ground plane.)
  bitGeometru.translate(0, -bit.height / 2, 0);  
  bitGeometru.rotateX(-Math.PI / 2); // Rotate so the rectangle lies in the X‑Z plane (normal +Y)
  const bitMesh = new THREE.Mesh(bitGeometru, bitMaterial);
  bitMesh.position.set(10, 10, 0)
  
  return bitMesh;
}