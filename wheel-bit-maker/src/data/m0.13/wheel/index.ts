import * as THREE from 'three';
import { bit1mm, bit3_175mm, cloneSegment, convertPointToSegment, reverseSegmentList } from "../../../helpers";
import { generatePath } from '../../helpers';

export const filename = 'm=0.13 Z=112.stl';

const bottomCut = -0.6

const _points: Segment[] = [
  { // left base
    from: { x: -1,      y: 0, z: bottomCut },
    to:   { x: -0.209,  y: 0, z: bottomCut },
  },
  { // from base to first arc
    from: { x: -0.209,  y: 0, z: bottomCut },
    to:   { x: -0.209,  y: 0, z: -0.335 },
  },
  { // left first arc
    from:   { x: -0.209, y: 0, z: -0.335 },
    to:     { x: -0.099, y: 0, z: -0.13 },
    center: { x: -0.359, y: 0, z: -0.122, anticlockwise: false },
  },
  { // left line between arcs
    from: { x: -0.099,  y: 0, z: -0.13 },
    to:   { x: -0.099,  y: 0, z: -0.096 },
  },
  { // left tip to center
    from:   { x: -0.099, y: 0, z: -0.096 },
    to:     { x: 0,      y: 0, z: 0 },
    center: { x: 0,      y: 0, z: -0.099, anticlockwise: true },
  },
  {
    from:   { x: 0,      y: 0, z: 0 },
    to:     { x: 0.099,  y: 0, z: -0.096 },
    center: { x: 0,      y: 0, z: -0.099, anticlockwise: true },
  },
  {
    from: { x: 0.099,   y: 0, z: -0.096 },
    to:   { x: 0.099,   y: 0, z: -0.13 },
  },
  {
    from:   { x: 0.099,  y: 0, z: -0.13 },
    to:     { x: 0.209,  y: 0, z: -0.335 },
    center: { x: 0.359,  y: 0, z: -0.122, anticlockwise: false },
  },
  {
    from: { x: 0.209,   y: 0, z: -0.335 },
    to:   { x: 0.209,   y: 0, z: bottomCut - 0.1 },
  }, 
  { // right base
    from: { x: 0.209,   y: 0, z: bottomCut - 0.1 },
    to:   { x: -1,      y: 0, z: bottomCut - 0.1 },
  },
].map(it => {
  const offsetX = -0.209;
  const offsetY = 0;
  const offsetZ = 1.2970;
  [it.from, it.to, it.center].forEach(k => {
    if (!k) { return; }
    k.x += offsetX;
    k.y += offsetY; 
    k.z += offsetZ;
  })
  return convertPointToSegment(it);
});

const left = _points.slice(1, 5).map(it => convertPointToSegment(cloneSegment(it)));
let p0 = cloneSegment(_points[1]);
p0.to = p0.from.clone();
p0.from = p0.from.clone().sub(new THREE.Vector3(0.5, 0 ,0))
left.unshift(convertPointToSegment(p0));
// point 2
// p0 = cloneSegment(left[left.length-1]);
// delete p0.center;
// p0.from = p0.to.clone(); 
// p0.to = p0.to.clone().add(new THREE.Vector3(0.05, 0 ,0))
// left.push(convertPointToSegment(p0));

// Grab the raw point objects for the right-hand profile
const rawRight = _points.slice(5, 9).map(cloneSegment); 
const rawRightReversed = reverseSegmentList(rawRight); 
const right = rawRightReversed.map(convertPointToSegment);

// Add the little vertical “stub” as before (already points the right way)
p0 = cloneSegment(_points[9]);
p0.to = p0.from.clone();
p0.from = p0.from.clone().add(new THREE.Vector3(0.5, 0, 0));
right.unshift(p0);
// poin 
p0 = cloneSegment(right[right.length-1]);
delete p0.center;
p0.from = p0.to.clone(); 
p0.to = p0.to.clone().sub(new THREE.Vector3(0.05, 0 ,0))
right.push(convertPointToSegment(p0));

export const points: ISegments = {
  all: _points.map(it => convertPointToSegment(cloneSegment(it))),
  left,
  right,
}

export const getPasses = (stockRadius: number, stepOver: number) => {
  const passes: any = [];
  const z = 0;
  //=====================================================================
  // PASS 0
  //=====================================================================
  let bit = bit3_175mm;
  let bitRadius = bit.diameter * 0.5;
  // console.log('Getting m0.13 Z112')
  const safeX = (bitRadius + (bitRadius*0.1));
  const safeY = (stockRadius + bitRadius + 2);
  const lineStart = [
    { x: safeX, y: safeY, z }, 
    { x: safeX, y: stockRadius, z }, 
    { x: 0, y: stockRadius, z }
  ];
  lineStart.forEach(it => it.y += bitRadius);

  let lineA = [ // the border of the stock
    { x: 3, y: stockRadius, z }, 
    { x: -25.6, y: stockRadius, z }
  ];
  let lineB =  // the inner profile
    [
      { x: 3, y: 1.3, z },
      { x: -0.42, y: 1.3, z },
      { x: -0.42, y: 0.7, z },
      { x: -10, y: 0.7, z },
      { x: -15.6, y: stockRadius, z }
    ];

  lineA.forEach(it => it.y += bitRadius);
  let lineB_offset = JSON.parse(JSON.stringify(lineB))
  let i = 0;
  i=0;  lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].y += bitRadius;
  
  passes.push({ bit, ...generatePath({lineStart, lineA, lineB, lineB_offset, stepOver}) });
  //=====================================================================
  // PASS 1
  //=====================================================================
  bit = bit1mm;
  bitRadius = bit.diameter * 0.5
  lineA = [ // the border of the stock
    { x: 1, y: 2, z }, 
    { x: -10.0, y: 2, z }
  ];
  lineB =  // the inner profile
    [
      { x: 1, y: 1.298, z },
      { x: -0.419, y: 1.298, z },
      { x: -0.419, y: 0.7, z },
      { x: -10, y: 0.7, z }, 
    ];
  lineA.forEach(it => it.y += bitRadius);
  lineB_offset = JSON.parse(JSON.stringify(lineB));

  i = 0;
  i=0;  lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
  passes.push({ bit, ...generatePath({lineStart, lineA, lineB, lineB_offset, stepOver}) });
  
  // Pass 3 - tooth
  passes.push({bit: bit3_175mm}); // this is the tooth
  // ------------------- 
  return passes;
}