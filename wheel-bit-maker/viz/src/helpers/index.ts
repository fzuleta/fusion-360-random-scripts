import * as THREE from 'three';

/** Degrees → radians. */
export const degToRad = (deg: number): number => deg * Math.PI / 180;

/** Radians → degrees. */
export const radToDeg = (rad: number): number => rad * 180 / Math.PI;

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