import * as THREE from 'three'; 

type Segment = {
  type: 'line' | 'arc',
  from: THREE.Vector2,
  to: THREE.Vector2,
  center?: THREE.Vector2,
  anticlockwise?: boolean,
  length: number
};

const convertToSegments = (pointsTooth: ITeethPoint[]): Segment[] => {
  return pointsTooth.map(pt => {
    const from = new THREE.Vector2(pt.from.x, pt.from.y);
    const to = new THREE.Vector2(pt.to.x, pt.to.y);
    if (pt.center) {
      const center = new THREE.Vector2(pt.center.x, pt.center.y);
      const radius = center.distanceTo(from);

      const v1 = from.clone().sub(center);
      const v2 = to.clone().sub(center);
      const cross = v1.x * v2.y - v1.y * v2.x;        // +ve ⇒ CCW sweep
      const anticlock = cross > 0;                     // true  ⇒ anticlockwise

      const angle1 = Math.atan2(v1.y, v1.x);
      const angle2 = Math.atan2(v2.y, v2.x);
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

export const getMesh = (pointsTooth: ITeethPoint[]) => { 
  const group = new THREE.Group(); 
  const shape = new THREE.Shape();
  const toothAsSegments = convertToSegments(pointsTooth);
  let currentPos: THREE.Vector2 | null = null;

  toothAsSegments.forEach((pt, i) => {
    const from = pt.from;
    const to = pt.to;

    if (!currentPos) {
      shape.moveTo(from.x, from.y);
      currentPos = from.clone();
    }

    if (pt.center) {
      const center = pt.center; // new THREE.Vector2(pt.center.x, pt.center.y);
      const radius = center.distanceTo(from);
      const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
      const endAngle = Math.atan2(to.y - center.y, to.x - center.x);
      // Three.js expects a *clockwise* flag, so pass the negation.
      shape.absarc(center.x, center.y, radius, startAngle, endAngle, !pt.anticlockwise);
    } else {
      shape.lineTo(to.x, to.y);
    }

    currentPos = to.clone();
  });
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5 })); 
  group.add(mesh);

  const wheelRadius = 0.381 / 2;
  const wheelGeometry = new THREE.CircleGeometry(wheelRadius, 64);
  const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x3366ff });
  const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial); 

  // Get tangent segment (points[8])
  const pFrom = new THREE.Vector2(pointsTooth[8].from.x, pointsTooth[8].from.y);
  const pTo = new THREE.Vector2(pointsTooth[8].to.x, pointsTooth[8].to.y);
  const tangent = pTo.clone().sub(pFrom).normalize();
  const normal = new THREE.Vector2(-tangent.y, tangent.x); // perpendicular

  const contactPoint = pFrom.clone(); // contact at start of segment
  const center = contactPoint.clone().add(normal.multiplyScalar(wheelRadius));

  wheel.position.set(center.x, center.y, 0.011); // Flip Y like the shape

  group.add(wheel);
  group.position.set(0, 0, 0.001)

  // create circles 
  const allPositions: THREE.Vector2[] = [];
  const speed = 0.05; //0.002;
  const totalLength = getSegmentsFromTo(toothAsSegments, wheelRadius).reduce((sum, seg) => sum + seg.length, 0);
  const state = { d: 0, speed: 0.001 };
  while (state.d < totalLength) {
    const pos = animateWheel({state, wheel, wheelRadius, toothAsSegments});
    if (pos) allPositions.push(pos.clone()); // store a copy
    state.d += speed;
  }

  const markerGeometry = new THREE.SphereGeometry(0.01, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

  allPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, pos.y, 0.02);
    group.add(marker);
  });
  
  return {group, wheel, wheelRadius, toothAsSegments};
}
const cloneSegment = (seg: Segment): Segment => ({
  from: seg.from.clone(),
  to: seg.to.clone(),
  type: seg.type,
  length: seg.length,
  center: seg.center,
  anticlockwise: seg.anticlockwise,
});
const getSegmentsFromTo = (pathSegments: Segment[], wheelRadius: number) => {
  const paths = pathSegments.slice(2, 9).map(it => cloneSegment(it)) // from index [3, 8]
  const p0 = cloneSegment(pathSegments[0]);
  const p1 = cloneSegment(pathSegments[1]);  
  p0.to.x -= wheelRadius; 
  p1.from.y += wheelRadius; 
  p1.to.y = paths[0].from.y + wheelRadius - 0.025; 
  
  paths[6].from.y += wheelRadius - 0.025

  paths.unshift(...[p0, p1]);
  return paths.map(it => {
    it.length = it.from.distanceTo(it.to);
    return it;
  });
}
type WheelAnimationState = {
  d: number;
  speed: number;
  // you can extend this with flags later (paused, direction, loop, etc)
};

const defaultstate = { d: 0, speed: 0.001 };
export function animateWheel(props: { state?: WheelAnimationState, toothAsSegments: Segment[], wheel: THREE.Mesh, wheelRadius: number}) {
  const state = props.state || defaultstate;
  const { wheel, toothAsSegments, wheelRadius} = props
  const paths = getSegmentsFromTo(toothAsSegments, wheelRadius);
  const totalLength = paths.reduce((sum, seg) => sum + seg.length, 0);

  state.d += state.speed;
  const dWrapped = state.d % totalLength;

  let acc = 0;
  for (const seg of paths) {
    if (acc + seg.length >= dWrapped) {
      const localD = dWrapped - acc;

      if (seg.type === 'line') {
        const dir = seg.to.clone().sub(seg.from).normalize();
        const pos = seg.from.clone().add(dir.clone().multiplyScalar(localD));
        const normal = new THREE.Vector2(-dir.y, dir.x);
        const center = pos.clone().add(normal.multiplyScalar(wheelRadius));
        wheel.position.set(center.x, center.y, 0.02); 
        return center;
      } else if (seg.type === 'arc' && seg.center) {
        const radius = seg.center.distanceTo(seg.from);

        // Work out the swept angle for the current arc‑length travelled.
        // Note: for anticlockwise arcs we need the angle to DECREASE
        const angleStart = Math.atan2(seg.from.y - seg.center.y,
                                      seg.from.x - seg.center.x);
        const angleDelta = (localD / radius) * (seg.anticlockwise ? 1 : -1);
        const angle      = angleStart + angleDelta;

        // Contact point on the original profile
        const pos = new THREE.Vector2(
          seg.center.x + radius * Math.cos(angle),
          seg.center.y + radius * Math.sin(angle)
        );

        // OUTWARD radial direction (i.e. the direction the wheel’s centre must move)
        // For clockwise arcs this is +radial, for anticlockwise arcs it is -radial.
        const radial  = pos.clone().sub(seg.center).normalize();
        const outward = seg.anticlockwise ? radial.clone().negate() : radial;
        const contact = pos.clone().add(outward.multiplyScalar(wheelRadius));

        wheel.position.set(contact.x, contact.y, 0.02);
        return contact;
      }

      break;
    }
    acc += seg.length;
  }
}