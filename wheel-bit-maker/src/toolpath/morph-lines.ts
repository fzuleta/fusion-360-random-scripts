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
  const feedFor = (so: number) => baseFeed * (so / stepOver);  // naïve linear scaling

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
    segments.push({
      kind: 'cut',
      pts: cutZ === undefined
        ? line                              // keep incoming z
        : line.map(p => ({ ...p, z: cutZ })), // flatten if caller insists
      feed: feedFor(stepOver),
    });
    
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
  segments: ToolpathSegment[];
  /** If ≤ 0 or omitted, NO A-axis moves are emitted. */
  rotationSteps?: number;
  /** One-off rotary index after the entire tool-path (deg). */
  indexAfterPath?: number;
}): string[] {
  const { segments, rotationSteps = 0, indexAfterPath } = props;

  const gcode: string[] = [];
  const hasRotary   = rotationSteps > 0;
  const angleStep   = hasRotary ? 360 / rotationSteps : 0;
  let   currentAngle = 0;

  const line = (cmd: 'G0' | 'G1', p: PointXYZ, feed?: number) =>
    `${cmd} X${p.x.toFixed(3)} Y${p.y.toFixed(3)}${p.z !== undefined ? ` Z${p.z.toFixed(3)}` : ''}${feed ? ` F${feed}` : ''}`;

  for (const seg of segments) {
    switch (seg.kind) {
      case 'rapid':
        seg.pts.forEach(p => gcode.push(line('G0', p)));
        break;
      case 'plunge':
      case 'retract':
      case 'cut':
        seg.pts.forEach(p => gcode.push(line('G1', p, seg.feed)));
        break;
    }

    // After every CUT pass, advance the rotary axis once
    if (hasRotary && seg.kind === 'cut') {
      gcode.push(`G1 A${currentAngle.toFixed(3)}`);
      currentAngle += angleStep;
    } 
  }
  // Optional single index after finishing the whole path
  if (!hasRotary && typeof indexAfterPath === 'number') {
    gcode.push(`G0 A${indexAfterPath.toFixed(3)}`);
  }
  return gcode;
}
