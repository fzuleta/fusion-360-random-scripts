import * as THREE from 'three';

import { morphLinesAdaptive } from '../../toolpath/morph-lines';

export const generatePath = (props: {  
  stepOver: number, 
  lineStart: PointXYZ[], 
  lineA: PointXYZ[], 
  lineB: PointXYZ[],
  lineB_offset: PointXYZ[];
}) => {
  const {stepOver, lineA, lineB_offset} = props;
  const originalLines: PointXYZ[][] = [props.lineStart, props.lineA, props.lineB];
  const lineStart = convertLinesToVector3s(props.lineStart,);
  const morphedLines = morphLinesAdaptive({ lineA, lineB: lineB_offset, stepOver, maxSeg: stepOver });
  
  const path=buildRasterPath(morphedLines, 0.1);
  path.unshift(...lineStart);
  
  return {
    originalLines,
    morphedLines,
    path,
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