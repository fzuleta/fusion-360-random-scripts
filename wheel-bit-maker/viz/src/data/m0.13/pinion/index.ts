import * as THREE from 'three';
import { bit1mm, bit3_175mm, cloneSegment, convertPointToSegment, reverseSegmentList } from "../../../helpers";

export const filename = 'm=0.13 z=14.stl';
 
const bottomCut = -0.6

const _points: Segment[] = [
  { // left base
    from: { x: -1,      y: 0,               z: bottomCut },
    to:   { x: -0.223,  y: 0,               z: bottomCut },
  },
  { // from base to first arc
    from: { x: -0.223,  y: 0,               z: bottomCut },
    to:   { x: -0.223,  y: 0,               z: -0.3025 },   // base of the tooth
  },
  { // left first arc
    from:   { x: -0.223, y: 0,              z: -0.3025 },
    to:     { x: -0.131, y: 0,              z: -0.218 },
    center: { x: -0.238, y: 0,              z: -0.193, anticlockwise: false },
  },
  { // left line between arcs
    from: { x: -0.131,  y: 0,               z: -0.218 },
    to:   { x: -0.111,  y: 0,               z: -0.089 },
  },
  { // left tip to center
    from:   { x: -0.111, y: 0,              z: -0.089 },
    to:     { x: 0,      y: 0,              z: 0 },
    center: { x: 0,      y: 0,              z: -0.114, anticlockwise: true },
  },
  { // right tip from center
    from:   { x: 0,      y: 0,              z: 0 },
    to:     { x: 0.111,  y: 0,              z: -0.089 },
    center: { x: 0,      y: 0,              z: -0.114, anticlockwise: true },
  },
  {
    from: { x: 0.111,   y: 0,               z: -0.089 },
    to:   { x: 0.131,   y: 0,               z: -0.218 },
  },
  {
    from:   { x: 0.131, y: 0,               z: -0.218 },
    to:     { x: 0.223, y: 0,               z: -0.3025 },
    center: { x: 0.238, y: 0,               z: -0.193, anticlockwise: false },
  },
  {
    from: { x: 0.223,   y: 0,               z: -0.3025 },
    to:   { x: 0.223,   y: 0,               z: bottomCut - 0.1 },
  },
  { // right base
    from: { x: 0.223,   y: 0,               z: bottomCut - 0.1 },
    to:   { x: -1,      y: 0,               z: bottomCut - 0.1 },
  },
].map(it => {
  const offsetX = -0.223;
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
p0.from = p0.from.clone().sub(new THREE.Vector3(1, 0 ,0))
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

export const getPasses = (stockRadius: number) => {
  const passes: any = [];
  let bitRadius = bit3_175mm.diameter / 2;
  // console.log('Getting m0.13 z14')
  const safeX = (bitRadius + (bitRadius*0.1));
  const safeY = (stockRadius + bitRadius + 2);
  const z = 0;
  //=====================================================================
  // PASS 0
  //===================================================================== 
  const lineStart = [
    { x: safeX, y: safeY, z }, 
    { x: safeX, y: stockRadius, z }, 
    { x: 0, y: stockRadius, z }
  ];
  let lineA = [
    { x: 0, y: stockRadius, z }, 
    { x: -25.6, y: stockRadius, z }
  ];
  let lineB =  
    [
      { x: 0, y: 1.303, z },
      { x: -0.45, y: 1.303, z },
      { x: -0.45, y: 0.7, z },
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
  passes.push({ lineStart, lineA, lineB, lineB_offset, bit: bit3_175mm });
  //=====================================================================
  // PASS 1
  //=====================================================================
  bitRadius = 0.381 / 2//1 / 2;
  lineA = [ // the border of the stock
    { x: 0, y: 1.5, z }, 
    { x: -5.0, y: 1.5, z }
  ];
  lineB =  // the inner profile
    [
      { x: 0, y: 1.298, z },
      { x: -0.45, y: 1.298, z },
      { x: -0.45, y: 0.7, z },
      { x: -5, y: 0.7, z }, 
    ];
  lineA.forEach(it => it.y += bitRadius);
  lineB_offset = JSON.parse(JSON.stringify(lineB));

  i = 0;
  i=0;  lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
  passes.push({ lineStart, lineA, lineB, lineB_offset, bit: bit3_175mm });
  
  passes.push({bit: bit3_175mm}); // this is the tooth
  
  return passes;
}