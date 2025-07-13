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

export const getMesh = (
  segments: ISegments, 
  stepOver: number) => { 
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
  defaultstate.speed = stepOver / 10;
  while (state.d < totalLength) {
    const pos = animateWheel({state, wheel, segments: segments.left});
    if (pos) leftPositions.push(pos.clone()); // store a copy
    state.d += state.speed;
  }

  const markerGeometry = new THREE.SphereGeometry(0.01, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff33f9 });

  leftPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, 0.02, pos.z);
    group.add(marker);
  });
  console.log(JSON.stringify(leftPositions))
  return {group, wheel, segments};
}
type WheelAnimationState = {
  d: number;
  speed: number;
  lastSignX?: number;   // remember previous horizontal offset sign (‑1 or +1)
};

const defaultstate: WheelAnimationState = { d: 0, speed: 0.001 };

export function animateWheel(props: { state?: WheelAnimationState, segments: Segment[], wheel: THREE.Mesh }) {
  const state = props.state || defaultstate;
  const { wheel, segments} = props
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