import * as THREE from 'three';
import { bit1mm, bit3_175mm, cloneSegment, convertPointToSegment, reverseSegmentList } from "../../../helpers";
import { createBitMesh, generatePath, generateToothPath } from '../../helpers';

import * as wheel from '../../../nihs_20_30/wheel';

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
  const offsetX = -0.209; // half of the tooth width
  const offsetY = 0;
  const offsetZ = 1.2970; // this is the height of the tooth from center of wheel to top
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

export const getPasses = (stockRadius: number, stepOver: number, feedRate: number) => {
  const passes: any = [];
  //=====================================================================
  // PASS 0 - Rough shape
  //=====================================================================
  {
    const bit = bit3_175mm;
    const bitMesh = createBitMesh(bit);
    const cutZ = -0.5;
    const z = cutZ;
    const bitRadius = bit.diameter * 0.5;
    // console.log('Getting m0.13 Z112') 
    const lineA = [ // the border of the stock
      { x: 0, y: stockRadius, z }, 
      { x: -25.6, y: stockRadius, z }
    ];
    const lineB =  // the inner profile
      [
        { x: 0, y: 1.303, z },
        { x: -0.45, y: 1.303, z },
        { x: -0.45, y: 0.7, z },
        { x: -10, y: 0.7, z },
        { x: -15.6, y: stockRadius, z }
      ];

    lineA.forEach(it => it.y += bitRadius);
    const lineB_offset = JSON.parse(JSON.stringify(lineB))
    let i = 0;
    i=0;  lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].y += bitRadius;
    
    passes.push({ bit, bitMesh, ...generatePath({ lineA, lineB: lineB_offset, stockRadius, stepOver, bit, feedRate, cutZ}) });
  }
  //=====================================================================
  // PASS 1 - rough shape more detail
  //=====================================================================
  {
    const bit = bit1mm;
    const bitMesh = createBitMesh(bit);
    const bitRadius = bit.diameter * 0.5
    const cutZ = -0.5;
    const z = cutZ; 
    const lineA = [ // the border of the stock
      { x: 0, y: 1.5, z }, 
      { x: -3.0, y: 1.5, z }
    ];
    const lineB =  // the inner profile
      [
        { x: 0, y: 1.298, z },
        { x: -0.45, y: 1.298, z },
        { x: -0.45, y: 0.7, z },
        { x: -3, y: 0.7, z }, 
      ];
    lineA.forEach(it => it.y += bitRadius);
    const lineB_offset = JSON.parse(JSON.stringify(lineB));

    let i = 0;
    i=0;  lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius; 
    passes.push({ bit, bitMesh, ...generatePath({ lineA, lineB: lineB_offset, stepOver, stockRadius, bit, feedRate, cutZ}) });
  }
  //=====================================================================
  // PASS 2 - Side flatten
  //=====================================================================
  {
    const bit = bit3_175mm;
    const bitMesh = createBitMesh(bit);
    const bitRadius = bit.diameter * 0.5
    const cutZ= 0;
    const z = cutZ; 

    const lineA =  // the inner profile
      [
        { x: 2 + bitRadius, y: 0.2 + 1.32 + bitRadius, z }, // 1.3 is the diameter of the outer disk , I added 0.02 as stock leftover
        { x: -5.0 + bitRadius, y: 0.2 + 1.32 + bitRadius, z }, // 1.3 is the diameter of the outer disk, I added 0.02 as stock leftover
      ];
    const lineB = [ // the border of the stock
      { x: 2, y: 0.7 + bitRadius, z }, 
      { x: -5.0, y: 0.7 + bitRadius, z }
    ]; 
 
    passes.push({ bit, bitMesh, ...generatePath({ lineA, lineB, stockRadius, stepOver, bit, feedRate, cutZ}) });
  }
  //=====================================================================
  // PASS 3 - Top flatten relief angles
  //=====================================================================
  {
    const bit = bit3_175mm;
    const bitMesh = createBitMesh(bit);
    const bitRadius = bit.diameter * 0.5
    const cutZ= 0.68;
    const z = cutZ; 

    const lineA = [ // the inner profile
        { x: 2,       y: 0.165 - bitRadius,   z },
        { x: 0,       y: 0.165 - bitRadius,   z },
        { x: -0.418,  y: 0.209 - bitRadius,   z }, // 6 deg relief
        // { x: -0.418,  y: 0.165 - bitRadius,   z }, // 6 deg relief
        { x: -3,  y: 0.209 - bitRadius,   z },
      ];
    const lineB = [ // the border of the stock
      { x: -3,  y: -1.5 - bitRadius,   z },
      { x: 2,  y: -1.5 - bitRadius,   z },
    ]; 
    passes.push({ bit, bitMesh, ...generatePath({ lineA, lineB, stockRadius, stepOver, bit, feedRate, cutZ, passDirection: 'bottom-to-top'}) });
  }
  //=====================================================================
  // PASS 4 -- TOOTH
  //=====================================================================
  {
    // Re‑use wheel.getMesh just to obtain the raster TVector3[] path
    const bit = bit3_175mm;
    const bitMesh = createBitMesh(bit);
    const { path } = wheel.getMesh(points, stepOver, bitMesh);

    const {
      segmentsForThreeJs,
      segmentsForGcodeFitted,
    } = generateToothPath(path);

    passes.push({
      bit: bit3_175mm,
      bitMesh,
      segmentsForThreeJs,
      segmentsForGcodeFitted,
    }); 
  }
  // ------------------- 
  return passes;
}