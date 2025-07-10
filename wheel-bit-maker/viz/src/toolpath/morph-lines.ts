const normalizeLineDirectionRightToLeft = (line: PointXY[]): PointXY[] => {
  return line[0].x >= line[line.length - 1].x ? line : [...line].reverse();
};

export function morphLines(props: {
  lineA: PointXY[];
  lineB: PointXY[];
  stepOver: number;
  bitRadius: number;
}): PointXY[][] {
  let {lineA, lineB } = props;
  const { stepOver, bitRadius } = props;
  lineA = JSON.parse(JSON.stringify(lineA));
  lineB = JSON.parse(JSON.stringify(lineB));
  const targetCount = Math.max(lineA.length, lineB.length);

  let A = lineA.length === targetCount ? lineA : resampleLine(lineA, lineB);
  let B = lineB.length === targetCount ? lineB : resampleLine(lineB, lineA);

  A = normalizeLineDirectionRightToLeft(
        offsetLineConsideringBitRadius(
          densifyLine(
            normalizeLineDirectionRightToLeft(A)
            , 5)
         , bitRadius
        )
      );

  B = normalizeLineDirectionRightToLeft(
        offsetLineConsideringBitRadius(
          densifyLine(
            normalizeLineDirectionRightToLeft(B)
            , 5)
          , bitRadius
        )
      );

  const newTarget = Math.max(A.length, B.length);
  if (A.length !== newTarget) A = resampleLine(A, B);
  if (B.length !== newTarget) B = resampleLine(B, A);

  const maxDeltaY = Math.max(
    ...A.map((p, i) => Math.abs(B[i].y - p.y))
  );
  const steps = Math.ceil(maxDeltaY / stepOver);

  const result: PointXY[][] = [];

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const line: PointXY[] = A.map((p, i) => ({
      x: p.x + (B[i].x - p.x) * t,
      y: p.y + (B[i].y - p.y) * t,
    }));
    result.push(line);
  }

  return result;
}

export function resampleLine(line: PointXY[], referenceLine?: PointXY[]): PointXY[] {
  if (line.length < 2) throw new Error("Line must have at least 2 points");

  if (referenceLine) {
    // Sort original line by X to ensure monotonicity
    const sorted = [...line].sort((a, b) => a.x - b.x);
    const result: PointXY[] = [];

    for (const ref of referenceLine) {
      let i = 0;
      while (i < sorted.length - 1 && sorted[i + 1].x < ref.x) i++;

      const p0 = sorted[i];
      const p1 = sorted[i + 1] ?? p0;

      const t = (ref.x - p0.x) / (p1.x - p0.x || 1);
      const y = p0.y + (p1.y - p0.y) * t;
      result.push({ x: ref.x, y });
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

  const targetCount = (referenceLine as PointXY[] | undefined)?.length ?? line.length;
  const result: PointXY[] = [];
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

    result.push({
      x: segStart.x + (segEnd.x - segStart.x) * t,
      y: segStart.y + (segEnd.y - segStart.y) * t,
    });

    currentDist += step;
  }

  return result;
}

/**
 * Subdivide each segment so that no segment is longer than `maxSeg`.
 * This helps the offset algorithm approximate curvature more accurately.
 */
const densifyLine = (line: PointXY[], maxSeg: number): PointXY[] => {
  if (line.length < 2) return [...line];

  const dense: PointXY[] = [];
  const isClosed =
    line[0].x === line[line.length - 1].x &&
    line[0].y === line[line.length - 1].y;

  const loopEnd = isClosed ? line.length : line.length - 1;

  for (let i = 0; i < loopEnd; i++) {
    const p0 = line[i];
    const p1 = i === line.length - 1 ? line[0] : line[i + 1];

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const segments = Math.max(1, Math.ceil(dist / maxSeg));

    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      dense.push({
        x: p0.x + dx * t,
        y: p0.y + dy * t,
      });
    }
  }

  dense.push(isClosed ? dense[0] : line[line.length - 1]);
  return dense;
};
export function generateGCodeFromMorph(props: {
  morphLines: PointXY[][],
  stockRadius: number,
  bitRadius: number,
  ZToCut: number,
  rotationSteps: number,
  feedRate: number
}): string[] {
  const {morphLines, stockRadius, bitRadius, ZToCut, rotationSteps, feedRate} = props;
  const lines: string[] = [];
  const angle = 360 / rotationSteps;
  let currentAngle = 0;
  let safeX = (bitRadius + 2).toFixed(3);
  const safeY = (stockRadius + bitRadius + 2).toFixed(3);

  const add = (s: string) => lines.push(s);

  add(`G1 X${safeX} Y${safeY} F${feedRate}`); // safe XY
  add(`G1 Z${ZToCut.toFixed(3)} F${feedRate}`);

  for (let i = 0; i < morphLines.length; i++) {
    const path = morphLines[i];

    if (path.length === 0) continue;

    // const direction = i % 2 === 0 ? path : [...path].reverse();
    const direction = path; // always forward

    // to first point
    const { x: x0, y: y0 } = direction[0];
    add(`G1 X${x0.toFixed(3)} Y${y0.toFixed(3)} F${feedRate}`);
    safeX = (x0).toFixed(3);
    // Cutting move
    for (const point of direction) {
      add(`G1 X${point.x.toFixed(3)} Y${point.y.toFixed(3)} F${feedRate}`);
    }
    add(`G0 Y${safeY}`);
    add(`G0 X${safeX}`);

    add(`G1 A${currentAngle.toFixed(3)} F${feedRate}`); 
    currentAngle+=angle;
  }

  return lines;
}

/**
 * Offset a poly-line by `radius` using the bisector-normal method.
 * No “outward = +Y” hack – the normal’s full X/Y is retained.
 */
export function offsetLineConsideringBitRadius(
  line: PointXY[],
  radius: number
): PointXY[] {
  return line;
  if (line.length < 2) return [...line];

  const isClosed =
    line[0].x === line[line.length - 1].x &&
    line[0].y === line[line.length - 1].y;

  const at = (i: number) =>
    isClosed
      ? line[(i + line.length) % line.length]
      : line[Math.max(0, Math.min(i, line.length - 1))];

  return line.map((p, i) => {
    const pPrev = at(i - 1);
    const pNext = at(i + 1);

    // Adjacent vectors
    const v1x = p.x - pPrev.x;
    const v1y = p.y - pPrev.y;
    const v2x = pNext.x - p.x;
    const v2y = pNext.y - p.y;

    // Unit normals for each segment (rotate left 90°)
    const len1 = Math.hypot(v1x, v1y) || 1;
    const len2 = Math.hypot(v2x, v2y) || 1;
    let nx = -(v1y / len1) - (v2y / len2);
    let ny =  (v1x / len1) + (v2x / len2);

    // Collinear fallback
    if (nx === 0 && ny === 0) {
      nx = -v1y / len1;
      ny =  v1x / len1;
    }

    // Normalise
    const nLen = Math.hypot(nx, ny);
    return {
      x: p.x + (radius * nx) / nLen,
      y: p.y + (radius * ny) / nLen,
    };
  });
}