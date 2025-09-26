import * as carbideBits from "../../../helpers/carbide-bits";
import {cloneSegment, convertPointToSegment } from "../../../helpers";
import { createBitMesh, generatePath, generateToothPath } from '../../helpers';

import * as wheel from '../../../nihs_20_30/wheel';
import type { IPass } from '../..';
import { getLeftRight } from '../wheel';

const bits = carbideBits;
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
 

export const getPasses = (stockRadius: number, material: TMaterial) => {
  const passes: IPass[] = [];
  //=====================================================================
  // PASS 0 - Rough shape
  //=====================================================================
  {
    const bit = bits.bit3_175mm_4_flute_chino;
    const matProps = bit.material[material];
    if (!matProps) { 
      alert('Material not found'); 
      return undefined; 
    }
    const bitMesh = createBitMesh(bit);
    const cutZ = -0.5;
    const z = cutZ;
    const bitRadius = bit.diameter * 0.5;
    // console.log('Getting m0.13 Z112') 
    const lineA = [ // the border of the stock
      { x: 3, y: stockRadius, z }, 
      { x: -17, y: stockRadius, z }
    ];
    const lineB =  // the inner profile
      [
        { x: 3, y: 1.303, z },
        { x: -0.45, y: 1.303, z },
        { x: -0.45, y: 0.7, z },
        { x: -15, y: 0.7, z },
        { x: -17, y: stockRadius, z }
      ];

    lineA.forEach(it => it.y += bitRadius);
    const lineB_offset = JSON.parse(JSON.stringify(lineB))
    let i = 0;
    i=0;  lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
    i++;  lineB_offset[i].y += bitRadius;
    
    const construction = {
      lineA, 
      lineB: lineB_offset, 
      stockRadius, 
      bit, 
      stepOver: matProps.stepOver, 
      feedRate: matProps.feedRate, 
      cutZ,
    }
    passes.push({ 
      name: "1. Rough",
      bit, 
      bitMesh,  
      construction,
      rotation: {
        mode: 'repeatPassOverRotation',
        steps: 360 / 8, // every 5 degrees
        startAngle: 0, 
        endAngle: 360
      }, 
      ...generatePath(construction), 
    });
  }
  //=====================================================================
  // PASS 1 - rough shape more detail
  //=====================================================================
  {
    const bit = bits.bit1_6mm_2_flute;
    const matProps = bit.material[material];
    if (!matProps) { 
      alert('Material not found'); 
      return undefined; 
    }
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

    const construction = { 
      lineA, 
      lineB: lineB_offset, 
      stockRadius, 
      bit, 
      stepOver: matProps.stepOver, 
      feedRate: matProps.feedRate, 
      cutZ
    }
    passes.push({ 
      name: "2. Finer Rough",
      bit, 
      bitMesh,
      construction,
      rotation: {
        mode: 'repeatPassOverRotation',
        steps: 360 / 8,  // every 5 degrees
        startAngle: 0, 
        endAngle: 360
      }, 
      ...generatePath(construction),
    });
  }
  //=====================================================================
  // PASS 2 - Side flatten
  //=====================================================================
  {
    const bit = bits.bit3_175mm_4_flute_chino;
    const matProps = bit.material[material];
    if (!matProps) { 
      alert('Material not found'); 
      return undefined; 
    }
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
 
    const construction = { 
      lineA, 
      lineB, 
      stockRadius, 
      bit, 
      stepOver: matProps.stepOver, 
      feedRate: matProps.feedRate, 
      cutZ,
    } 
    passes.push({ 
      name: "3. Side flatten",
      bit, 
      bitMesh,
      construction,
      rotation: {
        mode: 'repeatPassOverRotation',
        steps: 90 / 10,  // every 5 degrees
        startAngle: 0, 
        endAngle: -245
      }, 
      ...generatePath(construction),
    });
  }
  //=====================================================================
  // PASS 3 - Top flatten relief angles
  //=====================================================================
  {
    const bit = bits.bit3_175mm_4_flute_harveyTool;
    const matProps = bit.material[material];
    if (!matProps) { 
      alert('Material not found'); 
      return undefined; 
    }
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
    
    const construction = { 
      lineA, 
      lineB, 
      stockRadius, 
      bit, 
      stepOver: matProps.stepOver, 
      feedRate: matProps.feedRate, 
      cutZ, 
      passDirection: 'bottom-to-top' as any,
    }
    passes.push({ 
      name: "4. Relief angle",
      bit, 
      bitMesh,
      construction,
      ...generatePath(construction),
    });
  }
  //=====================================================================
  // PASS 4 -- TOOTH
  //=====================================================================
  {
    // Re‑use wheel.getMesh just to obtain the raster TVector3[] path
    const bit = bits.bit3_175mm_4_flute_harveyTool;
    const matProps = bit.material[material];
    if (!matProps) { 
      alert('Material not found'); 
      return undefined; 
    }
    const bitMesh = createBitMesh(bit);
    const {left, right} = getLeftRight(0.5)
    const points: ISegments = {
      all: _points.map(it => convertPointToSegment(cloneSegment(it))),
      left,
      right,
    }
    const { path } = wheel.getMesh(points, matProps.stepOver, bitMesh );
    
    const {
      segmentsForThreeJs,
      segmentsForGcodeFitted,
    } = generateToothPath(path, {
      baseFeed: matProps.feedRate,
      stepOver: matProps.stepOver,
      bitDiameter: bit.diameter,
    });

    const construction = {
      segmentsForThreeJs,
      segmentsForGcodeFitted,
      originalLines: [[], path],
    }
    passes.push({
      name: "5. Tooth",
      bit,
      bitMesh, 
      construction,
      ...construction,
      rotation: {
        mode: 'repeatPassOverRotation',
        steps: 45 / 3, 
        startAngle: 0, 
        endAngle: -45,
      }
    }); 
  }
  // ------------------- 
  return passes;
}