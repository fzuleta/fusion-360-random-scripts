import * as THREE from 'three';  
import { degToRad } from '../helpers';

export type TravelDir = 'L2R' | 'R2L';

type Segment = {
  type: string; //'line' | 'arc',
  from: THREE.Vector3,
  to: THREE.Vector3,
  center?: THREE.Vector3,
  anticlockwise?: boolean,
  length: number
};


export const getMesh = (segments: ISegments, stepOver: number, bitMesh: THREE.Mesh ) => { 
  const group = new THREE.Group(); 
  const shape = new THREE.Shape();
  let currentPos: THREE.Vector3 | null = null;

  segments.all.forEach((pt) => {
    const from = pt.from;
    const to = pt.to;

    if (!currentPos) {
      shape.moveTo(from.x, from.z);
      currentPos = from.clone();
    }

    if (pt.center) {
      const center = pt.center;
      const radius = center.distanceTo(from);
      const startAngle = Math.atan2(from.z - center.z, from.x - center.x);
      const endAngle = Math.atan2(to.z - center.z, to.x - center.x);
      // Three.js expects a *clockwise* flag, so pass the negation.
      shape.absarc(center.x, center.z, radius, startAngle, endAngle, !pt.anticlockwise);
    } else {
      shape.lineTo(to.x, to.z);
    }

    currentPos = to.clone();
  });
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );

  // Rotate the flat 2‑D shape so it lies in the X‑Z plane (normal +Y),
  // and lift it a hair to avoid z‑fighting with the wheel markers.
  mesh.rotateX( degToRad(90));
  mesh.position.y = -0.005;            // sits flush on Y=0 plane

  group.add(mesh);

  group.position.set(0, 0, 0.001)

  // create circles 
  const leftPositions: THREE.Vector3[] = []; 
  const lefttotalLength = segments.left.reduce((sum, seg) => sum + seg.length, 0);
  const state = { d: 0, speed: stepOver }; 
  while (state.d < lefttotalLength) {
    const pos = animateLeftPoints({
      state,
      bitMesh,
      segments: segments.left,
      applyTransform: false,   // don't move the wheel during marker pre‑pass
    });
    if (pos) leftPositions.push(pos.clone()); // store a copy
    state.d += state.speed;
  }

  const rightPositions: THREE.Vector3[] = []; 
  const righttotalLength = segments.right.reduce((sum, seg) => sum + seg.length, 0);
  state.d = 0; 
  while (state.d < righttotalLength) {
    const pos = animateLeftPoints({
      state,
      bitMesh,
      dir: 'R2L',
      segments: segments.right,
      applyTransform: false,   // don't move the wheel during marker pre‑pass
    });
    if (pos) rightPositions.push(pos.clone()); // store a copy
    state.d += state.speed;
  }

  const markerGeometry = new THREE.SphereGeometry(0.01, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff33f9 });

  const path = buildCompleteRasterPath(leftPositions, rightPositions, stepOver, 0.5 );

  leftPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, -0.02, pos.z);
    group.add(marker);
  });
  rightPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, -0.02, pos.z);
    group.add(marker);
  });
  // console.log(JSON.stringify(leftPositions))
  return {group, bitMesh, segments, path};
}
type WheelAnimationState = {
  d: number;
  speed: number;
};

/**
 * Returns the centre position for the millBit **on this frame**
 * so that its right‑hand edge touches the tool‑path point that is
 * ‘state.d’ millimetres along the supplied segments.
 *
 * The caller is responsible for advancing `state.d`
 * (so remove the old state.d += state.speed line **inside** this
 * function if you kept it in the caller’s loop).
 */
export function animateLeftPoints(
  props: {
    state: WheelAnimationState;           // running distance & step size
    segments: Segment[];                   // line | arc list, left➞right
    bitMesh: THREE.Mesh;                   // the wheel mesh (1mm × 10mm)
    dir?: TravelDir;           // 'L2R' (default) or 'R2L'
    applyTransform?: boolean;  // default=true
  }
): THREE.Vector3 | null {

  const {
    state,
    segments,
    bitMesh,
    dir = 'L2R',
  } = props;
  if (!segments.length) return null;

  /* ------------------------------------------------------------------ */
  /* 1.  Figure out where along the composite curve we are right now    */
  /* ------------------------------------------------------------------ */
  const totalLength = segments.reduce((acc, s) => acc + s.length, 0);

  // Wrap distance so we can cycle for ever
  const dWrapped = ((state.d % totalLength) + totalLength) % totalLength;

  // Locate the current segment and distance *inside* that segment
  let seg: Segment | undefined;
  let distIntoSeg = 0, running = 0;

  for (let i = 0; i < segments.length; i++) {
    if (running + segments[i].length >= dWrapped) {
      seg = segments[i];
      distIntoSeg = dWrapped - running;
      break;
    }
    running += segments[i].length;
  }
  if (!seg) seg = segments[segments.length - 1];  // fallback safety

  /* ------------------------------------------------------------------ */
  /* 2.  Get the XY (actually X‑Z) coordinates ON the tool‑path curve   */
  /* ------------------------------------------------------------------ */
  let px = 0, pz = 0;

  if (seg.type === 'line') {
    const t = distIntoSeg / seg.length;              // 0 → 1
    px = seg.from.x + t * (seg.to.x - seg.from.x);
    pz = seg.from.z + t * (seg.to.z - seg.from.z);

  } else if (seg.type === 'arc' && seg.center) {
    const r = seg.center.distanceTo(seg.from);
    const a0 = Math.atan2(seg.from.z - seg.center.z, seg.from.x - seg.center.x);
    const a1 = Math.atan2(seg.to.z   - seg.center.z, seg.to.x   - seg.center.x);

    // Determine signed sweep (positive CCW, negative CW)
    let sweep = a1 - a0;
    if (seg.anticlockwise) {
      if (sweep < 0) sweep += 2 * Math.PI;
    } else {
      if (sweep > 0) sweep -= 2 * Math.PI;
    }

    const t = distIntoSeg / seg.length;              // 0 → 1 along the arc
    const a = a0 + sweep * t;

    px = seg.center.x + r * Math.cos(a);
    pz = seg.center.z + r * Math.sin(a);

  } else {
    return null; // malformed segment – bail
  }

  /* ------------------------------------------------------------------ */
  /* 3.  Shift tool‑centre left so its RIGHT edge sits on (px,pz)        */
  /*     We know the bit’s width is 1 mm (see constant in wheel.ts).    */
  /* ------------------------------------------------------------------ */
  const geomParams = (bitMesh.geometry as any).parameters || {};
  const bitHalfWidth =
    'width' in geomParams
      ? geomParams.width / 2
      : 'radiusTop' in geomParams
        ? geomParams.radiusTop
        : undefined; // bit.diameter * 0.5;  // ultimate fallback
  if (bitHalfWidth === undefined) { throw new Error('Whats')}
  // Sign is –1 for left‑to‑right (centre shifts left), +1 for right‑to‑left
  const sign = dir === 'L2R' ? -1 : 1;
  const cx = px + sign * bitHalfWidth;
  const cz = pz;

  /* ------------------------------------------------------------------ */
  /* 4.  Return THREE.Vector3 in the X‑Z plane (Y=0)                    */
  /* ------------------------------------------------------------------ */
  return new THREE.Vector3(cx, 0, cz);
}


/**
 * Build a "back‑and‑forth" raster path for a single column of cutter
 * positions.  For every centre point in `posList` it emits four points:
 *
 *   [from, to, exitTo, exitFrom]
 *
 *   where:
 *     from     = (x,  y‑offset, z)
 *     to       = (x, +y‑offset, z)
 *     exitTo   = to.x  ± stepOver (sign depends on travel dir)
 *     exitFrom = from.x ± stepOver
 *
 * The sign of the step‑over is:
 *   • dir === 'L2R'  →  negative  (move leftwards)
 *   • dir === 'R2L'  →  positive  (move rightwards)
 *
 * @param posList   Array of centre‑line points (left or right column)
 * @param stepOver  Amount to offset the exit move in *X*
 * @param yOffset   Half‑stroke height (distance above/below centre line)
 * @param dir       Travel direction: 'L2R' (default) or 'R2L'
 * @returns         Flat array of THREE.Vector3 in the order
 *                  [from0, to0, exitTo0, exitFrom0, from1, to1, ...]
 */
export function buildRasterPath(
  posList: THREE.Vector3[],
  stepOver: number,
  yOffset: number,
  dir: TravelDir = 'L2R'
): THREE.Vector3[] {

  const sign = dir === 'L2R' ? -1 : 1;          // −stepOver for L→R, + for R→L
  const path: THREE.Vector3[] = [];

  for (const p of posList) {
    const from      = new THREE.Vector3(p.x, p.y - yOffset, p.z);
    const to        = new THREE.Vector3(p.x, p.y + yOffset, p.z);
    const exitTo    = new THREE.Vector3(to.x   + sign * stepOver, to.y,   to.z);
    const exitFrom  = new THREE.Vector3(from.x + sign * stepOver, from.y, from.z);

    path.push(from, to, exitTo, exitFrom);
  }

  return path;
}

const buildCompleteRasterPath = ( 
  leftPositions: THREE.Vector3[],
  rightPositions: THREE.Vector3[],
  stepOver: number,
  yOffset: number, 
) => {

  const path = buildRasterPath(leftPositions, stepOver, yOffset, 'L2R'); 
  const safeZ = (z = 1) => new THREE.Vector3(0,0,z);

  path.push(leftPositions[leftPositions.length-1].clone().add(safeZ(1))); 
  path.push(rightPositions[0].clone().add(safeZ(2)));
  path.push(...buildRasterPath(rightPositions, stepOver, yOffset, 'R2L'));

  path.push(rightPositions[leftPositions.length-1].clone().add(new THREE.Vector3(0,0,5)));
  
  console.log(path)
  return path;
}