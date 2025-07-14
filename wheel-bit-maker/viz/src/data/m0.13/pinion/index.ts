import * as THREE from 'three';
import { cloneSegment, convertPointToSegment } from "../../../helpers";

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
})

const left = _points.slice(1, 5).map(it => convertPointToSegment(cloneSegment(it)));
const pleft0 = cloneSegment(_points[1]);
pleft0.to = pleft0.from.clone();
pleft0.from = pleft0.from.clone().sub(new THREE.Vector3(1, 0 ,0))
left.unshift(convertPointToSegment(pleft0));

export const points: ISegments = {
  all: _points.map(it => convertPointToSegment(cloneSegment(it))),
  left,
  right: _points.slice(5, 9).map(it => convertPointToSegment(cloneSegment(it))),
}

export const getPasses = (stockRadius: number) => {
  const passes: any = [];
  let bitRadius = 3.175 / 2;
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
  passes.push({ lineStart, lineA, lineB, lineB_offset, bitRadius });
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
  passes.push({ lineStart, lineA, lineB, bitRadius, lineB_offset });
  
  passes.push(undefined); // this is the tooth
  
  return passes;
}