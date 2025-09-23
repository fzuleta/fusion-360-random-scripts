import * as THREE from 'three';

export const bit1mm: IBit = {diameter: 1, height: 10, toolNumber: 3, spindleSpeed: 30_000 }
export const bit3_175mm_2_flute: IBit = {diameter: 3.175, height: 10, toolNumber: 1, spindleSpeed: 16_000 }
export const bit3_175mm_4_flute: IBit = {diameter: 3.175, height: 10, toolNumber: 2, spindleSpeed: 16_000 }

/** Degrees → radians. */
export const degToRad = (deg: number): number => deg * Math.PI / 180;

/** Radians → degrees. */
export const radToDeg = (rad: number): number => rad * 180 / Math.PI;

export function isNumeric(str: any) {
  if (str == null) {
    return false;
  }
  const regx = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
  return regx.test(str);
}

// Returns an array like: [0,1,2,3,4,5] when range(6)
export function range(a: number, b?: number|undefined, step?: number|undefined): number[] {
  if (b === undefined && step === undefined) {
    b = a;
    a = 0;
  }
  b = b || 0;
  step = step || 1;

  if (b < a) {
    return range(b + 1, a + 1, step).reverse();
  }

  let x: number; const r: number[] = [];

  for (x = a; (b - x) * step > 0; x += step) {
    r.push(x);
  }
  return r;

}
export const cloneSegment = ((p: Segment): Segment => {
  return {
    type: p.type,
    from: p.from.clone(),
    to: p.to.clone(),
    center: p.center ? p.center.clone() : undefined,
    length: p.length,
    anticlockwise: p.anticlockwise,
  }
});
export const convertPointToSegment = (point: {from: PointXYZ; to: PointXYZ; center?: PointXYZ}): Segment => {
  const fcn = (pt: ITeethPoint): Segment => {
    const from = new THREE.Vector3(pt.from.x, pt.from.y, pt.from.z);
    const to = new THREE.Vector3(pt.to.x, pt.to.y, pt.to.z);
    if (pt.center) {
      const center = new THREE.Vector3(pt.center.x, pt.center.y, pt.center.z);
      const radius = center.distanceTo(from);

      const v1 = from.clone().sub(center);
      const v2 = to.clone().sub(center);
      const cross = v1.x * v2.z - v1.z * v2.x;        // +ve ⇒ CCW sweep
      const anticlock = cross > 0;                     // true  ⇒ anticlockwise

      const angle1 = Math.atan2(v1.z, v1.x);
      const angle2 = Math.atan2(v2.z, v2.x);
      const delta  = anticlock
          ? (angle1 - angle2 + Math.PI * 2) % (Math.PI * 2)
          : (angle2 - angle1 + Math.PI * 2) % (Math.PI * 2);

      const length = radius * delta;
      return { type: 'arc', from, to, center, anticlockwise: anticlock, length };
    } else {
      const length = from.distanceTo(to);
      return { type: 'line', from, to, length };
    }
  }
  return fcn(point); 
}
export function reverseSegmentList(raw: ITeethPoint[]): ITeethPoint[] {
  return raw
    .slice()               // make a shallow copy, leave original intact
    .reverse()             // 1) walk them in the opposite order
    .map(pt => {           // 2) flip the endpoints
      const rev: ITeethPoint = {
        from: { ...pt.to   },           // swap ends
        to:   { ...pt.from },
        center: pt.center ? { ...pt.center } : undefined,
      };
      if (rev.center) {
        rev.center.anticlockwise =
          rev.center.anticlockwise === undefined
            ? undefined
            : !rev.center.anticlockwise; // flip CW/CCW sense
      }
      return rev;
    });
}