const normalizeLineDirectionRightToLeft = (line: PointXY[]): PointXY[] => {
  return line[0].x >= line[line.length - 1].x ? line : [...line].reverse();
};

export function morphLines(props: {
  lineA: PointXY[],
  lineB: PointXY[],
  stepOver: number
}): PointXY[][] {
  const {lineA, lineB, stepOver} = props;
  const targetCount = Math.max(lineA.length, lineB.length);

  let A = lineA.length === targetCount ? lineA : resampleLine(lineA, targetCount);
  let B = lineB.length === targetCount ? lineB : resampleLine(lineB, targetCount);

  A = normalizeLineDirectionRightToLeft(A);
  B = normalizeLineDirectionRightToLeft(B);

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

export function resampleLine(line: PointXY[], targetCount: number): PointXY[] {
  if (line.length < 2) throw new Error("Line must have at least 2 points");

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