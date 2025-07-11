import * as THREE from 'three'; 

type ITeethPoint =  {from: PointXYZ, to: PointXYZ, center?: PointXYZ & {anticlockwise?: boolean}}

const bottomCut = -0.6
const pointsTooth: ITeethPoint[] = [

  { // left base
    from: { x: -1, y: -0.6, z: 0},
    to: { x: -0.209, y: -0.6, z: 0 },
  },
  { // from base to first arc
    from: { x: -0.209, y: -0.6, z: 0 }, 
    to: { x: -0.209, y: -0.335, z: 0 },
  },
  { // left first arc
    from: { x: -0.209, y: -0.335, z: 0 },
    to: { x: -0.099, y: -0.13, z: 0},
    center: { x: -0.359, y:-0.122, z:0, anticlockwise: false},
  },
  { // left line between arcs
    from: { x: -0.099, y: -0.13, z: 0},
    to: { x: -0.099, y: -0.096, z: 0 },
  },
  { // left tip to center
    from: { x: -0.099, y: -0.096, z: 0},
    to: { x: 0, y: 0, z: 0},
    center: { x: 0, y: -0.099, z:0, anticlockwise: true}
  },
  //
  {
    from: { x: 0, y: 0, z: 0},
    to: { x: 0.099, y: -0.096, z: 0},
    center: { x: 0, y: -0.099, z:0, anticlockwise: true}
  },
  {
    from: { x: 0.099, y: -0.096, z: 0 },
    to: { x: 0.099, y: -0.13, z: 0},
  },
  {
    from: { x: 0.099, y: -0.13, z: 0},
    to: { x: 0.209, y: -0.335, z: 0 },
    center: { x: 0.359, y:-0.122, z:0, anticlockwise: false},
  },

  {
    from: { x: 0.209, y: -0.335, z: 0},
    to: { x: 0.209, y: bottomCut - 0.1, z: 0 },
  }, 
 
].map(it => {
  const offsetX = -0.209;
  const offsetY = 1.2970;
  const offsetZ = 0.01;
  [it.from, it.to, it.center].forEach(k => {
    if (!k) { return; }
    k.x += offsetX;
    k.y += offsetY; 
    k.z += offsetZ;
  })
  return it;
}); 


type Segment = {
  type: 'line' | 'arc',
  from: THREE.Vector2,
  to: THREE.Vector2,
  center?: THREE.Vector2,
  anticlockwise?: boolean,
  length: number
};

const pathSegments: Segment[] = pointsTooth.map(pt => {
  const from = new THREE.Vector2(pt.from.x, pt.from.y);
  const to = new THREE.Vector2(pt.to.x, pt.to.y);
  if (pt.center) {
    const center = new THREE.Vector2(pt.center.x, pt.center.y);
    const radius = center.distanceTo(from);
    const angle1 = Math.atan2(from.y - center.y, from.x - center.x);
    const angle2 = Math.atan2(to.y - center.y, to.x - center.x);
    const delta = pt.center.anticlockwise ? 
      (angle1 - angle2 + Math.PI * 2) % (Math.PI * 2) : 
      (angle2 - angle1 + Math.PI * 2) % (Math.PI * 2);
    const length = radius * delta;
    return { type: 'arc', from, to, center, anticlockwise: pt.center.anticlockwise, length };
  } else {
    const length = from.distanceTo(to);
    return { type: 'line', from, to, length };
  }
});

export const getMesh = () => {

  const group = new THREE.Group();

  const shape = new THREE.Shape();
  let currentPos: THREE.Vector2 | null = null;

  pointsTooth.forEach((pt, i) => {
    const from = new THREE.Vector2(pt.from.x, pt.from.y);
    const to = new THREE.Vector2(pt.to.x, pt.to.y);

    if (!currentPos) {
      shape.moveTo(from.x, from.y);
      currentPos = from.clone();
    }

    if (pt.center) {
      const center = new THREE.Vector2(pt.center.x, pt.center.y);
      const radius = center.distanceTo(from);
      const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
      const endAngle = Math.atan2(to.y - center.y, to.x - center.x);
      shape.absarc(center.x, center.y, radius, startAngle, endAngle, !!pt.center.anticlockwise);
    } else {
      shape.lineTo(to.x, to.y);
    }

    currentPos = to.clone();
  });
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffcc00 })); 
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

  wheel.position.set(center.x, center.y, 0.02); // Flip Y like the shape

  group.add(wheel);
  group.position.set(0, 0, 0.001)

  // create circles 
  const allPositions: THREE.Vector2[] = [];
  const speed = 0.05; //0.002;
  const totalLength = getSegmentsFromTo(wheelRadius).reduce((sum, seg) => sum + seg.length, 0);
  const state = { d: 0, speed: 0.001 };
  while (state.d < totalLength) {
    const pos = animateWheel({state, wheel, wheelRadius});
    if (pos) allPositions.push(pos.clone()); // store a copy
    state.d += speed;
  }

  const markerGeometry = new THREE.SphereGeometry(0.01, 8, 8);
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  allPositions.forEach(pos => {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(pos.x, pos.y, 0.02);
    group.add(marker);
  });
  
  return {group, wheel, wheelRadius};
}
const cloneSegment = (seg: Segment): Segment => ({
  from: seg.from.clone(),
  to: seg.to.clone(),
  type: seg.type,
  length: seg.length,
  center: seg.center,
  anticlockwise: seg.anticlockwise,
});
const getSegmentsFromTo = (wheelRadius: number) => {
  const paths = pathSegments.slice(2, 10).map(it => cloneSegment(it)) // from index [3, 8]
  const p0 = cloneSegment(pathSegments[0]);
  const p1 = cloneSegment(pathSegments[1]);  
  p0.to.x -= wheelRadius; 
  p1.from.y += wheelRadius; 
  p1.to.y = paths[0].from.y + wheelRadius; 
  
  paths[6].from.y += wheelRadius

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
export function animateWheel(props: { state?: WheelAnimationState, wheel: THREE.Mesh, wheelRadius: number}) {
  const state = props.state || defaultstate;
  const { wheel, wheelRadius} = props
  const segmentSubset = getSegmentsFromTo(wheelRadius); 
  const totalLength = segmentSubset.reduce((sum, seg) => sum + seg.length, 0);

  state.d += state.speed;
  const dWrapped = state.d % totalLength;

  let acc = 0;
  for (const seg of segmentSubset) {
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
        const angleStart = Math.atan2(seg.from.y - seg.center.y, seg.from.x - seg.center.x);
        const angleDelta = localD / radius;
        const angle = seg.anticlockwise ? angleStart - angleDelta : angleStart + angleDelta;
        const pos = new THREE.Vector2(
          seg.center.x + radius * Math.cos(angle),
          seg.center.y + radius * Math.sin(angle)
        );
        const tangent = seg.anticlockwise ?
          new THREE.Vector2(
            radius * Math.sin(angle),
            -radius * Math.cos(angle)
          ) :
          new THREE.Vector2(
            -radius * Math.sin(angle),
            radius * Math.cos(angle)
          );
        const normal = tangent.clone().normalize().rotateAround(new THREE.Vector2(0, 0), Math.PI / 2);
        const contact = pos.clone().add(normal.multiplyScalar(wheelRadius));
        wheel.position.set(contact.x, contact.y, 0.02); 
        return contact;
      }

      break;
    }
    acc += seg.length;
  }
}