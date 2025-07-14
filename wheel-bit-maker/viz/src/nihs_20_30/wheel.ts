import * as THREE from 'three';  
import { degToRad } from '../helpers';

type Segment = {
  type: string; //'line' | 'arc',
  from: THREE.Vector3,
  to: THREE.Vector3,
  center?: THREE.Vector3,
  anticlockwise?: boolean,
  length: number
};

const bit = {width: 1, height: 10}

export const getMesh = (segments: ISegments, stepOver: number) => { 
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

  // ── Wheel as a thin rectangle (1 mm × 0.01 mm) ─────────────── 
  const wheelGeometry = new THREE.PlaneGeometry(bit.width, bit.height);

  // Put origin on the *bottom* edge (centre‑bottom in the plane’s local XY)
  wheelGeometry.translate(0, -bit.height / 2, 0);

  // Rotate so the rectangle lies in the X‑Z plane (normal +Y)
  wheelGeometry.rotateX(-Math.PI / 2);

  const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x8e98b3, side: THREE.DoubleSide });
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);

  // Keep the old radius value for clearance maths (half the width)
  const wheelRadius = bit.width / 2;

  // Get tangent segment (points[8])
  const pFrom = new THREE.Vector2(segments.all[8].from.x, segments.all[8].from.z);
  const pTo = new THREE.Vector2(segments.all[8].to.x, segments.all[8].to.z);
  const tangent = pTo.clone().sub(pFrom).normalize();
  const normal = new THREE.Vector2(-tangent.y, tangent.x); // perpendicular

  const contactPoint = pFrom.clone(); // contact at start of segment
  const center = contactPoint.clone().add(normal.multiplyScalar(wheelRadius));

  wheel.position.set(center.x, 0, center.y); // Flip Y like the shape

  group.add(wheel);
  group.position.set(0, 0, 0.001)

  // create circles 
  const leftPositions: THREE.Vector3[] = []; 
  const totalLength = segments.left.reduce((sum, seg) => sum + seg.length, 0);
  const state = { d: 0, speed: stepOver }; 
  while (state.d < totalLength) {
    const pos = animateLeftPoints({state, millBit: wheel, segments: segments.left});
    if (pos) leftPositions.push(pos.clone()); // store a copy
    state.d += state.speed;
  }

  const markerGeometry = new THREE.SphereGeometry(0.01, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff33f9 });

  leftPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, -0.02, pos.z);
    group.add(marker);
  });
  console.log(JSON.stringify(leftPositions))
  return {group, wheel, segments};
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
    millBit: THREE.Mesh;                   // the wheel mesh (1mm × 10mm)
  }
): THREE.Vector3 | null {

  const { state, segments, millBit } = props;
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
  const planeParams = (millBit.geometry as THREE.PlaneGeometry).parameters;
  const bitHalfWidth =
    planeParams ? planeParams.width / 2 : bit.width * 0.5; // Fallback to 0.5 mm if .parameters is missing

  // Because we are travelling left→right, “left” is –X
  const cx = px - bitHalfWidth;   // tool centre X
  const cz = pz;                  // keep exact track height (Z in the scene)

  /* ------------------------------------------------------------------ */
  /* 4.  Return THREE.Vector3 in the X‑Z plane (Y=0)                    */
  /* ------------------------------------------------------------------ */
  millBit.position.set(cx, 0 ,cz)
  return new THREE.Vector3(cx, 0, cz);
}