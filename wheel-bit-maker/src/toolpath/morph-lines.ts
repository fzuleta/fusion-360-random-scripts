import * as THREE from 'three';

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

type RotationConfig = {
  mode: TRotationMode;
  steps: number;
  startAngle: number;
  endAngle: number;
  angleAfterCompleted?: number;
};

const FULL_TURN_DEGREES = 360;
const ROTATION_EPSILON = 1e-9;

const isWholeTurnSweep = (totalAngle: number) =>
  Math.abs(Math.abs(totalAngle) - FULL_TURN_DEGREES) <= ROTATION_EPSILON;

export function getRotaryAngles(rotation?: RotationConfig): number[] {
  if (!rotation) return [0];

  if (!Number.isFinite(rotation.steps) || !Number.isInteger(rotation.steps) || rotation.steps <= 0) {
    throw new Error(`rotation.steps must be a positive integer, got ${rotation.steps}`);
  }

  if (rotation.steps === 1) {
    return [rotation.startAngle];
  }

  const totalAngle = rotation.endAngle - rotation.startAngle;
  const includeEndAngle = Math.abs(totalAngle) > ROTATION_EPSILON && !isWholeTurnSweep(totalAngle);
  const divisor = includeEndAngle ? rotation.steps - 1 : rotation.steps;
  const angleStep = divisor === 0 ? 0 : totalAngle / divisor;

  return Array.from({ length: rotation.steps }, (_, step) => rotation.startAngle + step * angleStep);
}

export interface MachineActionSettings {
  homeZBeforeStart: boolean;
  homeZAfterEnd: boolean;
  homeXYAfterEnd: boolean;
  resetRotaryAfterEnd: boolean;
}

export interface GCodeSettings {
  workOffset: string;
  toolNumber?: number;
  spindleSpeed?: number;
  safeRetract: {
    x?: number;
    y?: number;
    z: number;
  };
  machineActions: MachineActionSettings;
}

export const DEFAULT_GCODE_SETTINGS: GCodeSettings = {
  workOffset: 'G54',
  safeRetract: { z: 0 },
  machineActions: {
    homeZBeforeStart: true,
    homeZAfterEnd: true,
    homeXYAfterEnd: true,
    resetRotaryAfterEnd: true,
  },
};

const normalizeWorkOffset = (value: string) => value.trim().toUpperCase();

const isValidWorkOffset = (value: string) =>
  /^G5[4-9]$/.test(value) || /^G54\.1\s+P\d+$/i.test(value);

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
  baseFeed: number;     // feed‑rate for a full‑width cut
  plungeFeed?: number;  // optional slower plunge / retract feed
}): ToolpathSegment[] {
  const { passes, safeY, cutZ, baseFeed, plungeFeed = baseFeed * 0.4 } = props;
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
      segments.push({
        kind: 'cut',
        pts: [p0, p1],
        feed: baseFeed,         // constant: use manufacturer mm/min
      });
    }

    // 4) retract back up in Y (rapid)
    segments.push({ kind: 'rapid', pts: [{ x: last.x, y: safeY, z: last.z }] });
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
  material: TMaterial,
  bit: IBit;
  segments: ToolpathSegment[];
  rotation?: RotationConfig;
  settings?: GCodeSettings;
}): string[] {
  const { bit, material, segments, rotation, settings } = props;
  const rotaryAngles = getRotaryAngles(rotation);

  const materialSpindleSpeed = bit.material[material]?.spindleSpeed;
  if (settings?.spindleSpeed !== undefined && (!Number.isFinite(settings.spindleSpeed) || settings.spindleSpeed <= 0)) {
    throw new Error(`Spindle speed must be a positive number, got ${settings.spindleSpeed}`);
  }
  if (settings?.spindleSpeed === undefined && materialSpindleSpeed === undefined) {
    throw new Error('Spindle speed is required. Set an RPM in Post Settings or define one on the selected bit/material.');
  }
  const spindleSpeed = Math.round(settings?.spindleSpeed ?? materialSpindleSpeed ?? 0);
  if (settings?.toolNumber !== undefined && (!Number.isFinite(settings.toolNumber) || !Number.isInteger(settings.toolNumber) || settings.toolNumber <= 0)) {
    throw new Error(`Tool number must be a positive integer, got ${settings.toolNumber}`);
  }
  const toolNumber = Math.trunc(settings?.toolNumber ?? bit.toolNumber);
  if (!Number.isFinite(toolNumber) || toolNumber <= 0) {
    throw new Error(`Tool number must be a positive integer, got ${toolNumber}`);
  }
  const workOffset = normalizeWorkOffset(settings?.workOffset ?? DEFAULT_GCODE_SETTINGS.workOffset);
  if (!isValidWorkOffset(workOffset)) {
    throw new Error(`Unsupported work offset: ${workOffset}. Use G54-G59 or G54.1 Pn.`);
  }
  const safeRetract = {
    ...DEFAULT_GCODE_SETTINGS.safeRetract,
    ...settings?.safeRetract,
  };
  const machineActions = {
    ...DEFAULT_GCODE_SETTINGS.machineActions,
    ...settings?.machineActions,
  };
  if (safeRetract.x !== undefined && !Number.isFinite(safeRetract.x)) {
    throw new Error(`safe retract X must be a finite number, got ${safeRetract.x}`);
  }
  if (safeRetract.y !== undefined && !Number.isFinite(safeRetract.y)) {
    throw new Error(`safe retract Y must be a finite number, got ${safeRetract.y}`);
  }
  if (!Number.isFinite(safeRetract.z)) {
    throw new Error(`safe retract Z must be a finite number, got ${safeRetract.z}`);
  }

  const gcode: string[] = [
    'G90 G94 G91.1 G40 G49 G17', // abs, mm/min, IJ inc, cancel comp, XY plane
    'G21',                       // metric
    `( TOOL ${toolNumber}  Ø${bit.diameter.toFixed(3)} CVD-DIA )`,
    `T${toolNumber} M6`,
    `S${spindleSpeed} M3`,
    'G04 P1.0' ,                // 1-second dwell for full RPM -- according to chatgpt CVD coating can take a little bit to get the air in
    'M8',                       // air / coolant on
    workOffset,                 // work offset
    `G43 Z${safeRetract.z.toFixed(1)} H${toolNumber}`, // length offset + safe height
  ];
  if (machineActions.homeZBeforeStart) {
    gcode.splice(2, 0, 'G28 G91 Z0.', 'G90');
  }
  const safeRetractZ = safeRetract.z;
  const approachOffsetZ = 1.0;
  let lastFeed: number | undefined = undefined;
  let lastMotionPoint: PointXYZ | undefined;

  // Pre-position XY at safe Z to the very first commanded point
  const firstPtSeg = segments.find(s => s.pts.length > 0);
  if (firstPtSeg) {
    const pt = firstPtSeg.pts[0];
    gcode.push(`G0 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} ; pre-position XY at safe Z`);
    lastMotionPoint = { x: pt.x, y: pt.y, z: safeRetractZ };
  }

  const hasRotary   = !!rotation;
  const aStart = rotation?.startAngle ?? 0;
  const firstRotaryAngle = rotaryAngles[0] ?? aStart;

  if (hasRotary) {
    gcode.push(`G0 A${firstRotaryAngle.toFixed(3)}    ; set rotary start`);
  }

  const isSamePoint = (a: PointXYZ, b: PointXYZ) =>
    a.x === b.x && a.y === b.y && a.z === b.z;

  const isSameXY = (a: PointXYZ, b: PointXYZ) =>
    a.x === b.x && a.y === b.y;

  const pushG0 = (p: PointXYZ) => {
    if (lastMotionPoint && isSamePoint(lastMotionPoint, p)) return;
    gcode.push(`G0 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}${p.z !== undefined ? ` Z${p.z.toFixed(3)}` : ''}`);
    lastMotionPoint = p;
  };

  const pushG1 = (p: PointXYZ, feed?: number) => {
    if (lastMotionPoint && isSamePoint(lastMotionPoint, p)) return;
    const needsF = feed !== undefined && feed !== lastFeed;
    if (feed !== undefined && needsF) lastFeed = feed;
    gcode.push(
      `G1 X${p.x.toFixed(3)} Y${p.y.toFixed(3)}${p.z !== undefined ? ` Z${p.z.toFixed(3)}` : ''}${needsF ? ` F${feed}` : ''}`
    );
    lastMotionPoint = p;
  };

  const retractForRotaryIndex = () => {
    if (!lastMotionPoint) return;
    if (lastMotionPoint.z < safeRetractZ) {
      gcode.push(`G0 Z${safeRetractZ.toFixed(1)}`);
      lastMotionPoint = { ...lastMotionPoint, z: safeRetractZ };
    }
    if (safeRetract.x !== undefined || safeRetract.y !== undefined) {
      pushG0({
        x: safeRetract.x ?? lastMotionPoint.x,
        y: safeRetract.y ?? lastMotionPoint.y,
        z: safeRetractZ,
      });
    }
  };

  const prepareForFeedMove = (target: PointXYZ) => {
    if (!lastMotionPoint) return;
    const approachZ = Math.max(target.z, Math.min(safeRetractZ, target.z + approachOffsetZ));

    if (!isSameXY(lastMotionPoint, target)) {
      pushG0({ x: target.x, y: target.y, z: lastMotionPoint.z });
    }

    if (lastMotionPoint.z > approachZ) {
      pushG0({ x: target.x, y: target.y, z: approachZ });
    }
  };

  const emitSeg = (seg: ToolpathSegment) => {
    switch (seg.kind) {
      case 'rapid':
      case 'retract': // treat retracts as true rapids in G‑code
        seg.pts.forEach(pushG0);
        break;
      case 'plunge':
        prepareForFeedMove(seg.pts[0]);
        seg.pts.forEach(p => pushG1(p, seg.feed));
        break;
      case 'cut':
        prepareForFeedMove(seg.pts[0]);
        seg.pts.forEach(p => pushG1(p, seg.feed));
        break;
      // case 'arc': {
      //   const [a, b] = seg.pts;
      //   const { cx, cy, cw } = seg.arc!;
      //   const g = cw ? 'G2' : 'G3';
      //   const i = (cx - a.x).toFixed(3);
      //   const j = (cy - a.y).toFixed(3);
      //   const needsF = seg.feed !== undefined && seg.feed !== lastFeed;
      //   if (seg.feed !== undefined && needsF) lastFeed = seg.feed;
      //   gcode.push(`${g} X${b.x.toFixed(3)} Y${b.y.toFixed(3)} I${i} J${j}${needsF ? ` F${seg.feed}` : ''}`);
      //   break;
      // }
      case 'arc': {
        const [a, b] = seg.pts;
        const { cx, cy, cw } = seg.arc!;
        if (isSamePoint(a, b)) break;
        if (lastMotionPoint && !isSamePoint(lastMotionPoint, a)) {
          throw new Error('Arc segment start does not match current tool position');
        }
        const g = cw ? 'G2' : 'G3';
        const i = (cx - a.x).toFixed(3);
        const j = (cy - a.y).toFixed(3);
        const zTerm = b.z !== undefined ? ` Z${b.z.toFixed(3)}` : '';
        const needsF = seg.feed !== undefined && seg.feed !== lastFeed;
        if (seg.feed !== undefined && needsF) lastFeed = seg.feed;
        gcode.push(`${g} X${b.x.toFixed(3)} Y${b.y.toFixed(3)}${zTerm} I${i} J${j}${needsF ? ` F${seg.feed}` : ''}`);
        lastMotionPoint = b;
        break;
      }
    }
  };

  if (!rotation || rotation.mode === 'fullPassPerRotation') {
    // ---- Original behaviour: do full path, then rotate ----
    for (const currentAngle of rotaryAngles) {
      if (hasRotary) {
        retractForRotaryIndex();
        gcode.push(`G0 A${currentAngle.toFixed(3)}`);
      }
      segments.forEach(emitSeg);
    }
  } else if (rotation.mode === 'onePassPerRotation') {
    const passes = splitSegmentsIntoPasses(segments);

    const totalPasses = passes.length;
    const requiredSteps = rotation.steps;

    if (hasRotary && totalPasses !== requiredSteps) {
      throw new Error(`onePassPerRotation requires passes (${totalPasses}) to equal rotation.steps (${requiredSteps})`);
    }

    passes.forEach((pass, idx) => {
      const currentAngle = rotaryAngles[idx] ?? firstRotaryAngle;
      if (idx > 0 && hasRotary) {
        retractForRotaryIndex();
        gcode.push(`G0 A${currentAngle.toFixed(3)}`);
      } else if (idx === 0 && hasRotary) {
        retractForRotaryIndex();
        gcode.push(`G0 A${currentAngle.toFixed(3)}`);
      }
      pass.forEach(emitSeg);
    });

  } else if (rotation.mode === 'repeatPassOverRotation') {
    // ---- Every pass is replayed at EACH rotary step ----
    const passes = splitSegmentsIntoPasses(segments);

    // Iterate each pass; within each pass iterate *all* rotary steps
    passes.forEach((pass, passIdx) => {
      if (hasRotary) {
        // Always start each pass at the base angle
        retractForRotaryIndex();
        gcode.push(`G0 A${firstRotaryAngle.toFixed(3)}    ; pass ${passIdx+1} reset`);
      }
      for (const angle of rotaryAngles) {
        if (hasRotary) {
          retractForRotaryIndex();
          gcode.push(`G0 A${angle.toFixed(3)}`);
        }
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

  gcode.push('M9');            // Coolant off (turns off air or flood)
  gcode.push('M5');            // Spindle stop

  if (machineActions.homeZAfterEnd) {
    gcode.push('G28 G91 Z0.');
    gcode.push('G90');
  }

  if (machineActions.resetRotaryAfterEnd && hasRotary) {
    gcode.push('G0 A0.');
  }

  if (machineActions.homeXYAfterEnd) {
    gcode.push('G28 G91 X0. Y0.');
    gcode.push('G90');
  }

  gcode.push('M30');           // Program end and rewind
  return gcode;
}

export function splitSegmentsIntoPasses(allSegments: ToolpathSegment[]): ToolpathSegment[][] {
  const passes: ToolpathSegment[][] = [];
  let buf: ToolpathSegment[] = [];
  let sawCutMotion = false;
  const hasCutMotion = (segments: ToolpathSegment[]) =>
    segments.some((seg) => seg.kind === 'plunge' || seg.kind === 'cut' || seg.kind === 'arc');

  allSegments.forEach(seg => {
    buf.push(seg);

    if (seg.kind === 'plunge' || seg.kind === 'cut' || seg.kind === 'arc') {
      sawCutMotion = true;
    }

    // A pass ends at the first rapid after any cut/plunge motion.
    if (seg.kind === 'rapid' && sawCutMotion) {
      passes.push(buf);
      buf = [];
      sawCutMotion = false;
    }
  });

  if (buf.length && hasCutMotion(buf)) passes.push(buf);
  return passes;
}

export function buildMachinePreviewPath(props: {
  segments: ToolpathSegment[];
  rotation?: RotationConfig;
  safeRetract?: GCodeSettings['safeRetract'];
  approachOffsetZ?: number;
  arcRes?: number;
}): TVector3[] {
  const {
    segments,
    rotation,
    safeRetract = DEFAULT_GCODE_SETTINGS.safeRetract,
    approachOffsetZ = 1,
    arcRes = 0.2,
  } = props;
  const rotaryAngles = getRotaryAngles(rotation);

  const out: TVector3[] = [];
  let lastMotionPoint: PointXYZ | undefined;
  const safeRetractZ = safeRetract.z;

  const isSamePoint = (a: PointXYZ, b: PointXYZ) =>
    a.x === b.x && a.y === b.y && a.z === b.z;

  const isSameXY = (a: PointXYZ, b: PointXYZ) =>
    a.x === b.x && a.y === b.y;

  const pushPoint = (p: PointXYZ, kind: 'cut' | 'rapid' | 'arc') => {
    const v = new THREE.Vector3(p.x, p.y, p.z) as TVector3;
    v.isCut = kind === 'cut';
    v.isRapid = kind === 'rapid';
    v.isArc = kind === 'arc';

    const prev = out[out.length - 1];
    if (prev && prev.equals(v)) {
      prev.isCut = prev.isCut || v.isCut;
      prev.isRapid = prev.isRapid || v.isRapid;
      prev.isArc = prev.isArc || v.isArc;
      return;
    }

    out.push(v);
  };

  const pushRapidTo = (p: PointXYZ) => {
    if (lastMotionPoint && isSamePoint(lastMotionPoint, p)) return;
    pushPoint(p, 'rapid');
    lastMotionPoint = p;
  };

  const pushCutTo = (p: PointXYZ, kind: 'cut' | 'arc' = 'cut') => {
    if (lastMotionPoint && isSamePoint(lastMotionPoint, p)) return;
    pushPoint(p, kind);
    lastMotionPoint = p;
  };

  const retractForRotaryIndex = () => {
    if (!lastMotionPoint) return;
    if (lastMotionPoint.z < safeRetractZ) {
      pushRapidTo({ ...lastMotionPoint, z: safeRetractZ });
    }
    if (safeRetract.x !== undefined || safeRetract.y !== undefined) {
      pushRapidTo({
        x: safeRetract.x ?? lastMotionPoint.x,
        y: safeRetract.y ?? lastMotionPoint.y,
        z: safeRetractZ,
      });
    }
  };

  const prepareForFeedMove = (target: PointXYZ) => {
    if (!lastMotionPoint) {
      pushRapidTo({ x: target.x, y: target.y, z: safeRetractZ });
    }
    if (!lastMotionPoint) return;

    const approachZ = Math.min(safeRetractZ, target.z + approachOffsetZ);

    if (!isSameXY(lastMotionPoint, target)) {
      pushRapidTo({ x: target.x, y: target.y, z: lastMotionPoint.z });
    }

    if (lastMotionPoint.z > approachZ) {
      pushRapidTo({ x: target.x, y: target.y, z: approachZ });
    }
  };

  const tessellateArc = (seg: ToolpathSegment): PointXYZ[] => {
    const [a, b] = seg.pts;
    const { cx, cy, r, cw } = seg.arc!;
    const a0 = Math.atan2(a.y - cy, a.x - cx);
    const a1 = Math.atan2(b.y - cy, b.x - cx);
    const span = cw
      ? (a0 > a1 ? a0 - a1 : a0 - a1 + 2 * Math.PI)
      : (a1 > a0 ? a1 - a0 : a1 - a0 + 2 * Math.PI);
    const steps = Math.min(200, Math.max(2, Math.ceil(r * span / arcRes)));
    const pts: PointXYZ[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = cw ? a0 - span * t : a0 + span * t;
      pts.push({
        x: cx + r * Math.cos(ang),
        y: cy + r * Math.sin(ang),
        z: a.z + (b.z - a.z) * t,
      });
    }
    return pts;
  };

  const emitSegmentAtAngle = (seg: ToolpathSegment, _angleDeg: number) => {
    switch (seg.kind) {
      case 'rapid':
      case 'retract':
        seg.pts.forEach(pushRapidTo);
        break;
      case 'plunge': {
        prepareForFeedMove(seg.pts[0]);
        seg.pts.forEach(p => pushCutTo(p));
        break;
      }
      case 'cut': {
        prepareForFeedMove(seg.pts[0]);
        seg.pts.forEach(p => pushCutTo(p));
        break;
      }
      case 'arc': {
        const pts = tessellateArc(seg);
        prepareForFeedMove(pts[0]);
        pts.forEach(p => pushCutTo(p, 'arc'));
        break;
      }
    }
  };

  const hasRotary = !!rotation;

  if (!rotation || rotation.mode === 'fullPassPerRotation') {
    for (const currentAngle of rotaryAngles) {
      if (hasRotary) {
        retractForRotaryIndex();
      }
      segments.forEach(seg => emitSegmentAtAngle(seg, currentAngle));
    }
  } else if (rotation.mode === 'onePassPerRotation') {
    const passes = splitSegmentsIntoPasses(segments);
    if (passes.length !== rotation.steps) {
      throw new Error(`onePassPerRotation requires passes (${passes.length}) to equal rotation.steps (${rotation.steps})`);
    }
    passes.forEach((pass, idx) => {
      if (idx > 0) {
        retractForRotaryIndex();
      }
      const currentAngle = rotaryAngles[idx] ?? rotaryAngles[0] ?? 0;
      pass.forEach(seg => emitSegmentAtAngle(seg, currentAngle));
    });
  } else if (rotation.mode === 'repeatPassOverRotation') {
    const passes = splitSegmentsIntoPasses(segments);
    passes.forEach((pass) => {
      retractForRotaryIndex();
      rotaryAngles.forEach((angle, step) => {
        if (step > 0) {
          retractForRotaryIndex();
        }
        pass.forEach(seg => emitSegmentAtAngle(seg, angle));
      });
    });
  } else {
    segments.forEach(seg => emitSegmentAtAngle(seg, 0));
  }

  return out;
}

export function buildMachineDisplayPath(props: {
  segments: ToolpathSegment[];
  rotation?: RotationConfig;
  safeRetract?: GCodeSettings['safeRetract'];
  approachOffsetZ?: number;
  arcRes?: number;
}): TVector3[] {
  const { segments, rotation, safeRetract, approachOffsetZ, arcRes } = props;

  if (!rotation || rotation.mode === 'fullPassPerRotation') {
    return buildMachinePreviewPath({
      segments,
      rotation: rotation
        ? {
            ...rotation,
            steps: 1,
            endAngle: rotation.startAngle,
          }
        : undefined,
      safeRetract,
      approachOffsetZ,
      arcRes,
    });
  }

  const passes = splitSegmentsIntoPasses(segments);
  const firstPass = passes[0] ?? [];
  return buildMachinePreviewPath({
    segments: firstPass,
    rotation: {
      mode: 'fullPassPerRotation',
      steps: 1,
      startAngle: rotation.startAngle,
      endAngle: rotation.startAngle,
      angleAfterCompleted: rotation.angleAfterCompleted,
    },
    safeRetract,
    approachOffsetZ,
    arcRes,
  });
}
