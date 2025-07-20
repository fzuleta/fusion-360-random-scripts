export type MotionKind = 'rapid' | 'plunge' | 'cut' | 'arc' | 'retract';

export interface ArcExtras {
  cw: boolean;          // true = G2, false = G3
  cx: number;           // centre X (I/J style also possible)
  cy: number;           // centre Y
  r:  number;           // radius (optional if using I/J)
}

export interface ToolpathSegment {
  kind: MotionKind;
  pts: PointXYZ[];      // for ARC, pts = [start, end]
  feed?: number;
  arc?: ArcExtras;      // only defined when kind === 'arc'
}

export interface MorphAdaptiveProps {
  lineA: PointXYZ[];
  lineB: PointXYZ[];
  stepOver: number;        // max allowed ΔY between passes
  eps?: number;
  maxIter?: number;
  maxSeg?: number;         // optional explicit densify target
}

// --- Helper ------------------------------------------------------
const normR2L = (pts: PointXYZ[]): PointXYZ[] =>
  pts[0].x >= pts[pts.length - 1].x ? pts : [...pts].reverse();

// --- Main --------------------------------------------------------
export function morphLinesAdaptive({
  lineA,
  lineB,
  stepOver,
  eps = 1e-6,
  maxIter = 1000,
  maxSeg,                   // if undefined we fall back to bitRadius or 1
}: MorphAdaptiveProps): PointXYZ[][] {
  if (stepOver <= 0) throw new Error("stepOver must be > 0");

  // ---------- 1. Deep‑copy & resample ----------
  const clone = (L: PointXYZ[]) => JSON.parse(JSON.stringify(L)) as PointXYZ[];
  let A = clone(lineA);
  let B = clone(lineB);
  const targetCount = Math.max(A.length, B.length);
  if (A.length !== targetCount) A = resampleLine(A, B);
  if (B.length !== targetCount) B = resampleLine(B, A);

  // ---------- 2. Densify ----------
  const seg = maxSeg ?? 1;
  A = densifyLine(normR2L(A), seg);
  B = densifyLine(normR2L(B), seg);
  // Re‑normalise for safety/parity
  A = normR2L(A);
  B = normR2L(B);

  // After densify lengths may differ again
  const tgt = Math.max(A.length, B.length);
  if (A.length !== tgt) A = resampleLine(A, B);
  if (B.length !== tgt) B = resampleLine(B, A);

  // ---------- 3. Adaptive insert loop ----------
  const passes: PointXYZ[][] = [A, B];
  let idx = 0, iter = 0;
  while (idx < passes.length - 1) {
    if (++iter > maxIter) {
      throw new Error("morphLinesAdaptive: exceeded maxIter – check geometry");
    }

    const P = passes[idx], Q = passes[idx + 1];
    const maxGap = P.reduce(
      (m, p, i) => Math.max(m, Math.abs(Q[i].y - p.y)),
      0
    );
    if (maxGap <= stepOver + eps) {
      idx++;               // gap OK → advance
      continue;
    }

    const need = Math.ceil(maxGap / stepOver) - 1; // # extra passes
    const inv = 1 / (need + 1);
    for (let j = 1; j <= need; j++) {
      const t = j * inv;
      const mid = P.map((p, i) => ({
        x: p.x + (Q[i].x - p.x) * t,
        y: p.y + (Q[i].y - p.y) * t,
        z: p.z + (Q[i].z - p.z) * t,
      }));
      passes.splice(idx + j, 0, mid);
    }
    // stay at same idx; we want to verify new gaps next loop
  }

  return passes;
}

/**
 * Generate a sequence of semantically‑tagged tool‑path segments
 * (rapid → plunge → cut → retract) for each pass produced by
 * `morphLinesAdaptive`.
 */
export function planSegmentsFromPasses(props: {
  passes: PointXYZ[][];
  safeY: number;        // clearance plane in Y
  cutZ?: number;         // machining depth
  stepOver: number;     // radial engagement used when the pass set was built
  baseFeed: number;     // feed‑rate for a full‑width cut
  plungeFeed?: number;  // optional slower plunge / retract feed
}): ToolpathSegment[] {
  const { passes, safeY, cutZ, stepOver, baseFeed, plungeFeed = baseFeed * 0.4 } = props;
  const segments: ToolpathSegment[] = []; 

  for (const line of passes) {
    if (line.length === 0) continue;

    const first = line[0];
    const last  = line[line.length - 1];

    // 1) rapid in XY at clearance
    segments.push({ kind: 'rapid', pts: [{ x: first.x, y: safeY, z: first.z }] });

    // 2) plunge down to cutting depth
    segments.push({
      kind: 'plunge',
      pts: [{ x: first.x, y: first.y, z: cutZ === undefined ? first.z : cutZ }],
      feed: plungeFeed,
    });

    // 3) cutting move along the pass
    const pts = cutZ === undefined
      ? line
      : line.map(p => ({ ...p, z: cutZ }));

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dy = Math.abs(p1.y - p0.y);
      const ratio = Math.max(0.2, Math.min(dy / stepOver, 1));
      const feed = baseFeed * ratio;

      segments.push({
        kind: 'cut',
        pts: [p0, p1],
        feed,
      });
    }
    
    // 4) retract back up in Y
    segments.push({ kind: 'retract', pts: [{ x: last.x, y: safeY, z: last.z }], feed: plungeFeed });
  }

  return segments;
}

export function resampleLine(line: PointXYZ[], referenceLine?: PointXYZ[]): PointXYZ[] {
  if (line.length < 2) throw new Error("Line must have at least 2 points");

  if (referenceLine) {
    // Sort original line by X to ensure monotonicity
    const sorted = [...line].sort((a, b) => a.x - b.x);
    const result: PointXYZ[] = [];

    for (const ref of referenceLine) {
      let i = 0;
      while (i < sorted.length - 1 && sorted[i + 1].x < ref.x) i++;

      const p0 = sorted[i];
      const p1 = sorted[i + 1] ?? p0;

      const t = (ref.x - p0.x) / (p1.x - p0.x || 1);
      const y = p0.y + (p1.y - p0.y) * t;
      const z = (p0.z ?? 0) + ((p1.z ?? 0) - (p0.z ?? 0)) * t;
      result.push({ x: ref.x, y, z });
    }

    return result;
  }

  // Original logic: uniform resampling by arc length
  const segmentLengths: number[] = [];
  const cumulative: number[] = [0];
  let totalLength = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const dx = line[i + 1].x - line[i].x;
    const dy = line[i + 1].y - line[i].y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
    cumulative.push(totalLength);
  }

  const targetCount = (referenceLine as PointXYZ[] | undefined)?.length ?? line.length;
  const result: PointXYZ[] = [];
  const step = totalLength / (targetCount - 1);
  let currentDist = 0;
  let segIndex = 0;

  for (let i = 0; i < targetCount; i++) {
    while (
      segIndex < segmentLengths.length &&
      currentDist > cumulative[segIndex + 1]
    ) {
      segIndex++;
    }

    const segStart = line[segIndex];
    const segEnd = line[segIndex + 1];
    const segLen = segmentLengths[segIndex];
    const segOffset = currentDist - cumulative[segIndex];
    const t = segLen === 0 ? 0 : segOffset / segLen;
    const z = (segStart.z ?? 0) + ((segEnd.z ?? 0) - (segStart.z ?? 0)) * t;

    result.push({
      x: segStart.x + (segEnd.x - segStart.x) * t,
      y: segStart.y + (segEnd.y - segStart.y) * t,
      z,
    });

    currentDist += step;
  }

  return result;
}

/**
 * Subdivide each segment so that no segment is longer than `maxSeg`.
 * This helps the offset algorithm approximate curvature more accurately.
 */
const densifyLine = (line: PointXYZ[], maxSeg: number): PointXYZ[] => {
  if (line.length < 2) return [...line];

  const dense: PointXYZ[] = [];
  const isClosed =
    line[0].x === line[line.length - 1].x &&
    line[0].y === line[line.length - 1].y;

  const loopEnd = isClosed ? line.length : line.length - 1;

  for (let i = 0; i < loopEnd; i++) {
    const p0 = line[i];
    const p1 = i === line.length - 1 ? line[0] : line[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = (p1.z ?? 0) - (p0.z ?? 0);
    const dist = Math.hypot(dx, dy, dz);
    const segments = Math.max(1, Math.ceil(dist / maxSeg));

    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      dense.push({
        x: p0.x + dx * t,
        y: p0.y + dy * t,
        z: p0.z + dz * t,
      });
    }
  }

  dense.push(isClosed ? dense[0] : line[line.length - 1]);
  return dense;
};

/**
 * Emit plain‑vanilla G‑code from an array of `ToolpathSegment`s.
 * The caller is expected to create the segments with `planSegmentsFromPasses`.
 */
export function generateGCodeFromSegments(props: {
  bit: IBit;
  segments: ToolpathSegment[];
  rotation?: {
    mode: TRotationMode;
    steps: number;
    startAngle: number;
    endAngle: number;
    angleAfterCompleted?: number;
  }
}): string[] {
  const { bit, segments, rotation } = props;
  const gcode: string[] = [
  'G90 G94 G91.1 G40 G49 G17', // abs, mm/min, IJ inc, cancel comp, XY plane
  'G21',                       // metric
  'G28 G91 Z0.',               // retract to machine Z-home
  'G90',

  `( TOOL ${bit.toolNumber}  Ø${bit.diameter.toFixed(3)} CVD-DIA )`,
  `T${bit.toolNumber} M6`,
  `S${bit.spindleSpeed} M3`,
  'G4 P1' ,                   // 1-second dwell for full RPM -- according to chatgpt CVD coating can take a little bit to get the air in
  'M8',                       // air / coolant on
  'G54',                      // work offset
  `G43 Z15.0 H${bit.toolNumber}`, // length offset + safe height
];

  const hasRotary   = !!rotation;
  const aStart = rotation?.startAngle ?? 0;
  const aEnd = rotation?.endAngle ?? 360;
  const totalAngle = aEnd - aStart;
  const angleStep = hasRotary ? totalAngle / rotation.steps : 0;

  if (hasRotary) {
    gcode.push(`G0 A${aStart.toFixed(3)}    ; set rotary start`);
  }

  let lastFeed: number | undefined = undefined;
  const line = (cmd: 'G0' | 'G1', p: PointXYZ, feed?: number) =>
    `${cmd} X${p.x.toFixed(3)} Y${p.y.toFixed(3)}${p.z !== undefined ? ` Z${p.z.toFixed(3)}` : ''}${feed ? ` F${feed}` : ''}`;

  const emitSeg = (seg: ToolpathSegment) => {
    switch (seg.kind) {
      case 'rapid':
        seg.pts.forEach(p => gcode.push(line('G0', p)));
        break;
      case 'plunge':
      case 'retract':
      case 'cut':
        seg.pts.forEach(p => gcode.push(line('G1', p, seg.feed)));
        break;
      case 'arc': {
        const [a, b] = seg.pts;
        const { cx, cy, cw } = seg.arc!;
        const g = cw ? 'G2' : 'G3';
        const i = (cx - a.x).toFixed(3);
        const j = (cy - a.y).toFixed(3);
        const feed = seg.feed !== undefined && seg.feed !== lastFeed ? ` F${seg.feed}` : '';
        if (seg.feed !== undefined) lastFeed = seg.feed;
        gcode.push(`${g} X${b.x.toFixed(3)} Y${b.y.toFixed(3)} I${i} J${j}${feed}`);
        break;
      }
    }
  };

  if (!rotation || rotation.mode === 'fullPassPerRotation') {
    // ---- Original behaviour: do full path, then rotate ----
    for (let step = 0; step < (hasRotary ? rotation.steps : 1); step++) {
      const currentAngle = aStart + step * angleStep;
      if (hasRotary) gcode.push(`G1 A${currentAngle.toFixed(3)}`);
      segments.forEach(emitSeg);
    }
  } else if (rotation.mode === 'onePassPerRotation') {
    // ---- New behaviour: emit one pass (rapid→plunge→cuts→retract), then rotate ----
    if (hasRotary) {
      // Ensure rotary is at the start angle before the first cut
      gcode.push(`G0 A${aStart.toFixed(3)}    ; set rotary start`);
    }

    // Group segments into passes ending in a retract
    const passes: ToolpathSegment[][] = [];
    let buf: ToolpathSegment[] = [];
    segments.forEach(seg => {
      buf.push(seg);
      if (seg.kind === 'retract') {
        passes.push(buf);
        buf = [];
      }
    });
    if (buf.length) passes.push(buf); // in case the last pass has no retract

    const totalPasses = passes.length;
    const requiredSteps = rotation.steps;

    if (hasRotary && totalPasses !== requiredSteps) {
      gcode.push(`(warning: passes=${totalPasses} but rotation.steps=${requiredSteps})`);
    }

    let currentAngle = aStart;

    passes.forEach((pass, idx) => {
      if (idx > 0 && hasRotary) {
        // Advance BEFORE starting the next pass
        currentAngle += angleStep;
        gcode.push(`G1 A${currentAngle.toFixed(3)}`);
      }
      pass.forEach(emitSeg);
    });

  } else if (rotation.mode === 'repeatPassOverRotation') {
    // ---- Every pass is replayed at EACH rotary step ----
    // Split the full segment list into "passes" ending with a retract
    const passes: ToolpathSegment[][] = [];
    let buf: ToolpathSegment[] = [];
    segments.forEach(seg => {
      buf.push(seg);
      if (seg.kind === 'retract') {
        passes.push(buf);
        buf = [];
      }
    });
    if (buf.length) passes.push(buf);   // trailing pass w/o retract

    // Iterate each pass; within each pass iterate *all* rotary steps
    passes.forEach((pass, passIdx) => {
      if (hasRotary) {
        // Always start each pass at the base angle
        gcode.push(`G0 A${aStart.toFixed(3)}    ; pass ${passIdx+1} reset`);
      }
      for (let step = 0; step < (hasRotary ? rotation.steps : 1); step++) {
        const angle = aStart + step * angleStep;
        if (hasRotary) gcode.push(`G1 A${angle.toFixed(3)}`);
        pass.forEach(emitSeg);
      }
    });
  } else {
    // Unknown rotation mode – emit a comment and default to afterAllPaths
    gcode.push('(warning: unknown rotation.mode; defaulting to afterAllPaths)');
    segments.forEach(emitSeg);
  }
  // Optional single index after finishing the whole path
  if (rotation && typeof rotation.angleAfterCompleted === 'number') {
    gcode.push(`G0 A${rotation.angleAfterCompleted.toFixed(3)}`);
  }

  gcode.push(...[
    'M9',                      // Coolant off (turns off air or flood)
    'M5',                      // Spindle stop
    'G28 G91 Z0.',             // Home Z-axis (machine zero) using relative mode
    'G90',                     // Restore absolute positioning
    'G0 A0.',                  // Return rotary axis A to zero position
    'G28 G91 X0. Y0.',         // Home X and Y axes (machine zero) using relative mode
    'G90',                     // Ensure we're back in absolute mode
    'M30'                      // Program end and rewind
  ]);
  return gcode;
}
