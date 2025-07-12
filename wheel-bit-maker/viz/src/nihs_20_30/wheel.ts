import * as THREE from 'three';  

type Segment = {
  type: 'line' | 'arc',
  from: THREE.Vector3,
  to: THREE.Vector3,
  center?: THREE.Vector3,
  anticlockwise?: boolean,
  length: number
};

const bit = {width: 1, height: 10}
/** Degrees → radians. */
export const degToRad = (deg: number): number => deg * Math.PI / 180;

/** Radians → degrees. */
export const radToDeg = (rad: number): number => rad * 180 / Math.PI;

const convertToSegments = (pointsTooth: ITeethPoint[]): Segment[] => {
  return pointsTooth.map(pt => {
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
  });
}

export const getMesh = (pointsTooth: ITeethPoint[], stepOver: number) => { 
  const group = new THREE.Group(); 
  const shape = new THREE.Shape();
  const toothAsSegments = convertToSegments(pointsTooth);
  let currentPos: THREE.Vector3 | null = null;

  toothAsSegments.forEach((pt) => {
    const from = pt.from;
    const to = pt.to;

    if (!currentPos) {
      shape.moveTo(from.x, from.z);
      currentPos = from.clone();
    }

    if (pt.center) {
      const center = pt.center; // new THREE.Vector2(pt.center.x, pt.center.z);
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
  const pFrom = new THREE.Vector2(pointsTooth[8].from.x, pointsTooth[8].from.z);
  const pTo = new THREE.Vector2(pointsTooth[8].to.x, pointsTooth[8].to.z);
  const tangent = pTo.clone().sub(pFrom).normalize();
  const normal = new THREE.Vector2(-tangent.y, tangent.x); // perpendicular

  const contactPoint = pFrom.clone(); // contact at start of segment
  const center = contactPoint.clone().add(normal.multiplyScalar(wheelRadius));

  wheel.position.set(center.x, 0, center.y); // Flip Y like the shape

  group.add(wheel);
  group.position.set(0, 0, 0.001)

  // create circles 
  const allPositions: THREE.Vector3[] = []; 
  const totalLength = getSegmentsFromTo(toothAsSegments).reduce((sum, seg) => sum + seg.length, 0);
  const state = { d: 0, speed: stepOver };
  defaultstate.speed = stepOver / 10;
  while (state.d < totalLength) {
    const pos = animateWheel({state, wheel, toothAsSegments});
    if (pos) allPositions.push(pos.clone()); // store a copy
    state.d += state.speed;
  }

  const markerGeometry = new THREE.SphereGeometry(0.01, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff33f9 });

  allPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, 0.02, pos.z);
    group.add(marker);
  });
  console.log(JSON.stringify(allPositions))
  return {group, wheel, toothAsSegments};
}
const cloneSegment = (seg: Segment): Segment => ({
  from: seg.from.clone(),
  to: seg.to.clone(),
  type: seg.type,
  length: seg.length,
  center: seg.center,
  anticlockwise: seg.anticlockwise,
});
const getSegmentsFromTo = (pathSegments: Segment[]) => {
  const paths = pathSegments.slice(1, 9).map(it => cloneSegment(it));
  const p0 = cloneSegment(pathSegments[0]);
  p0.from.sub(new THREE.Vector3(bit.width, 0, 0))
  p0.to = paths[0].from.clone().sub(new THREE.Vector3(bit.width, 0, 0)); 
  paths.unshift(p0);
  return paths.map(it => {
    it.length = it.from.distanceTo(it.to);
    return it;
  });
}
type WheelAnimationState = {
  d: number;
  speed: number;
  lastSignX?: number;   // remember previous horizontal offset sign (‑1 or +1)
};

const defaultstate: WheelAnimationState = { d: 0, speed: 0.001 };
export function animateWheel(props: { state?: WheelAnimationState, toothAsSegments: Segment[], wheel: THREE.Mesh }) {
  const state = props.state || defaultstate;
  const { wheel, toothAsSegments} = props
  const segments = getSegmentsFromTo(toothAsSegments);
  const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);

  state.d += state.speed;
  const dWrapped = state.d % totalLength;
  const bitWidthRadius = bit.width * 0.5;
  let acc = 0;
  for (const seg of segments) {
    if (acc + seg.length >= dWrapped) {
      const localD = dWrapped - acc;
      let pos: THREE.Vector3;

      // Re‑use last horizontal side unless we determine a new one
      let signX = state.lastSignX ?? -1;

      if (seg.type === 'line') {
        // Tangent direction
        const dir = seg.to.clone().sub(seg.from).normalize();
        pos = seg.from.clone().add(dir.multiplyScalar(localD));

        // Outward normal for a left‑hand contour is (‑dir.y, dir.x)
        const normal = new THREE.Vector2(-dir.z, dir.x).normalize();
        if (Math.abs(normal.x) > 1e-6) {
          // Usual case: outward normal has X component → pick that side
          signX = Math.sign(normal.x);
        } else if (Math.abs(dir.x) > 1e-6) {
          // Line is exactly horizontal ⇒ flip side based on travel direction
          signX = Math.sign(dir.x);
        }
      } else if (seg.center) { /* arc */ 
        // Parametric point on the arc at arc‑length = localD
        const radius = seg.center.distanceTo(seg.from);
        const startAngle = Math.atan2(seg.from.z - seg.center.z,
                                      seg.from.x - seg.center.x);
        const sweep = localD / radius * (seg.anticlockwise ? 1 : -1);
        const θ = startAngle + sweep;

        pos = new THREE.Vector3(
          seg.center.x + radius * Math.cos(θ),
          0,
          seg.center.z + radius * Math.sin(θ)
        );

        const radial = pos.clone().sub(seg.center).normalize();
        const outward = seg.anticlockwise ? radial.clone().negate() : radial;
        if (Math.abs(outward.x) > 1e-6) {
          signX = Math.sign(outward.x);
        }
      } else {
        // Fallback (shouldn’t happen)
        continue;
      }

      // Remember chosen side for next segment
      state.lastSignX = signX;

      // Apply X‑only offset
      pos.x += signX * bitWidthRadius;

      wheel.position.set(pos.x, 0, pos.z);
      return pos;
    }
    acc += seg.length;
  }
}