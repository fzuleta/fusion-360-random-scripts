import * as THREE from 'three';
import * as carbideBits from "../../../helpers/carbide-bits";
import { createBitMesh, generatePath, generateToothPath } from "../../helpers";
import { cloneSegment, convertPointToSegment, reverseSegmentList } from "../../../helpers";
import * as wheel from '../../../nihs_20_30/wheel'; 
import type { IConstruction, IConstructProps } from '../..';

export const filename = 'm=0.13 Z=112.stl';
const bits = carbideBits;

export const getHowManyPasses = () => 5;
export const getPass = (n: number) => {
  switch (n){
    case 0: return pass0;
    case 1: return pass1;
    case 2: return pass2;
    case 3: return pass3;
    case 4: return pass4;
    default:
      throw new Error('Pass doesnt exist');
  }
}

export const getLeftRight = (offsetX: number = 0.5, _points: Segment[]) => {
  const left = _points.slice(1, 5).map(it => convertPointToSegment(cloneSegment(it)));
  let p0 = cloneSegment(_points[1]);
  p0.to = p0.from.clone();
  p0.from = p0.from.clone().sub(new THREE.Vector3(offsetX, 0 ,0))
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
  p0.from = p0.from.clone().add(new THREE.Vector3(offsetX, 0, 0));
  right.unshift(p0);
  // poin 
  p0 = cloneSegment(right[right.length-1]);
  delete p0.center;
  p0.from = p0.to.clone(); 
  p0.to = p0.to.clone().sub(new THREE.Vector3(0.05, 0 ,0))
  right.push(convertPointToSegment(p0));

  return {left, right};
}
const pass0 = (): IConstruction => { 
  const bit = bits.bit3_175mm_4_flute_chino;
  const cutZ = -0.5;
  const lineA = [ // the border of the stock
    { x: 3, y: 0, z: cutZ }, 
    { x: -17, y: 0, z: cutZ }
  ];
  const lineB =  // the inner profile
    [
      { x: 3, y: 1.3, z: cutZ },
      { x: -0.42, y: 1.3, z: cutZ },
      { x: -0.42, y: 0.7, z: cutZ },
      { x: -15, y: 0.7, z: cutZ },
      { x: -17, y: 0, z: cutZ }
    ];
 
  const applyBitRadiusAndStockRadius = (bitRadius: number, stockRadius: number) => {
    const lA = JSON.parse(JSON.stringify(lineA));
    lA.forEach((it: any) => it.y += stockRadius + bitRadius); 

    const lB = JSON.parse(JSON.stringify(lineB));
    let i = 0;
    i=0;  lB[i].y += bitRadius;
    i++;  lB[i].x -= bitRadius; lB[i].y += bitRadius;
    i++;  lB[i].x -= bitRadius; lB[i].y += bitRadius;
    i++;  lB[i].x += bitRadius; lB[i].y += bitRadius;
    i++;  lB[i].y += stockRadius + bitRadius;

    return {
      lineA: lA,
      lineB: lB,
    }
  }

  return {
    name: "1. Rough", 
    type: 'lines',
    defaultBit: bit,
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = bit.diameter * 0.5; 
      const bitMesh = createBitMesh(bit); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      return {
        bit,
        bitMesh,
        rotation: {
          mode: 'repeatPassOverRotation',
          steps: 360 / 16, // every 8 degrees
          startAngle: 0, 
          endAngle: 360
        }, 
        ...generatePath({
          lineA, 
          lineB, 
          stockRadius, 
          bit, 
          stepOver: matProps.stepOver, 
          feedRate: matProps.feedRate, 
          cutZ,
        }),
      }
    },
  }
} 
const pass1 = (): IConstruction => { 
  const bit = bits.bit1_6mm_2_flute;  
  const cutZ = -0.5; 
  const z = cutZ; 
  
  const lineA = [ // the border of the stock
    { x: 1, y: 2, z }, 
    { x: -3.0, y: 2, z }
  ];
  const lineB =  // the inner profile
    [
      { x: 1, y: 1.298, z },
      { x: -0.419, y: 1.298, z },
      { x: -0.419, y: 0.7, z },
      { x: -3, y: 0.7, z }, 
    ];

  const applyBitRadiusAndStockRadius = (bitRadius: number, _: number) => {
    const lA = JSON.parse(JSON.stringify(lineA));
    const lB = JSON.parse(JSON.stringify(lineB)); 

    lA.forEach((it: any) => it.y += bitRadius);

    let i = 0;
    i=0;  lB[i].y += bitRadius;
    i++;  lB[i].x -= bitRadius; lB[i].y += bitRadius;
    i++;  lB[i].x -= bitRadius; lB[i].y += bitRadius;
    i++;  lB[i].x += bitRadius; lB[i].y += bitRadius;
    return {
      lineA: lA,
      lineB: lB,
    }
  }

  return {
    name: "2. Finer Rough", 
    type: 'lines',
    defaultBit: bit,
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = bit.diameter * 0.5; 
      const bitMesh = createBitMesh(bit); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      return {
        bit,
        bitMesh,
        rotation: {
          mode: 'repeatPassOverRotation',
          steps: 360 / 8,  // every 5 degrees
          startAngle: 0, 
          endAngle: 360
        }, 
        ...generatePath({
          lineA, 
          lineB, 
          stockRadius, 
          bit, 
          stepOver: matProps.stepOver, 
          feedRate: matProps.feedRate, 
          cutZ,
        }),
      }
    },
  }
} 
const pass2 = (): IConstruction => { 
  const bit = bits.bit3_175mm_4_flute_chino;   
  const cutZ= 0;
  const z = cutZ; 
  
  const lineA =  // the inner profile
    [
      { x: 2, y: 0.2 + 1.32, z }, // 1.3 is the diameter of the outer disk , I added 0.02 as stock leftover
      { x: -2.0, y: 0.2 + 1.32, z }, // 1.3 is the diameter of the outer disk, I added 0.02 as stock leftover
    ];
  const lineB = [ // the border of the stock
    { x: 2, y: 0.7, z: 0 }, 
    { x: -2.0, y: 0.7, z: 0 }
  ]; 

  const applyBitRadiusAndStockRadius = (bitRadius: number, _: number) => {
    const lA = JSON.parse(JSON.stringify(lineA));
    const lB = JSON.parse(JSON.stringify(lineB)); 

    lA.forEach((it: any) => {
      it.x += bitRadius;
      it.y += bitRadius;
    });
    lB.forEach((it: any) => {
      it.y += bitRadius;
    });

    return {
      lineA: lA,
      lineB: lB,
    }
  }

  return {
    name: "3. Side flatten", 
    type: 'lines',
    defaultBit: bit,
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = bit.diameter * 0.5; 
      const bitMesh = createBitMesh(bit); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      return {
        bit,
        bitMesh,
        rotation: {
          mode: 'repeatPassOverRotation',
          steps: 90 / 10,  // every 5 degrees
          startAngle: 0, 
          endAngle: -245
        }, 
        ...generatePath({
          lineA, 
          lineB, 
          stockRadius, 
          bit, 
          stepOver: matProps.stepOver, 
          feedRate: matProps.feedRate, 
          cutZ,
        }),
      }
    },
  }
} 
const pass3 = (): IConstruction => { 
  const bit = bits.bit3_175mm_4_flute_chino; 
  const cutZ= 0.68;
  const z = cutZ; 
  
  const lineA = [ // the inner profile
      { x: 2,       y: 0.165,   z },
      { x: 0,       y: 0.165,   z },
      { x: -0.418,  y: 0.209,   z }, // 6 deg relief
      // { x: -0.418,  y: 0.165,   z }, // 6 deg relief
      { x: -3,  y: 0.209,   z },
    ];
  const lineB = [ // the border of the stock
    { x: -3,  y: -1.5,   z },
    { x: 2,  y: -1.5,   z },
  ]; 

  const applyBitRadiusAndStockRadius = (bitRadius: number, _: number) => {
    const lA = JSON.parse(JSON.stringify(lineA));
    const lB = JSON.parse(JSON.stringify(lineB)); 

    lA.forEach((it: any) => { 
      it.y -= bitRadius;
    });
    lB.forEach((it: any) => {
      it.y -= bitRadius;
    });

    return {
      lineA: lA,
      lineB: lB,
    }
  }
  return {
    name: "4. Relief angle", 
    type: 'lines',
    defaultBit: bit,
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = bit.diameter * 0.5; 
      const bitMesh = createBitMesh(bit); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      return {
        bit,
        bitMesh,
        ...generatePath({
          lineA, 
          lineB, 
          stockRadius, 
          bit, 
          stepOver: matProps.stepOver, 
          feedRate: matProps.feedRate, 
          cutZ, 
          passDirection: 'bottom-to-top' as any,
        })
      }
    },
  }
} 
const pass4 = (): IConstruction => { 
  const bit = bits.bit3_175mm_4_flute_harveyTool; 
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

  const {left, right} = getLeftRight(0.5, _points);
  const points: ISegments = {
    all: _points.map(it => convertPointToSegment(cloneSegment(it))),
    left,
    right,
  }

  return {
    name: "5. Tooth", 
    type: 'tooth',
    defaultBit: bit, 
    construct: (props: {bit?: IBit; material: TMaterial; stockRadius: number}) => {
      const material = props.material;
      const b: IBit = props.bit || bit;
      const bitMesh = createBitMesh(bit); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const { path } = wheel.getMesh(points, matProps.stepOver, bitMesh);

      const {
        segmentsForThreeJs,
        segmentsForGcodeFitted,
      } = generateToothPath(path, {
        baseFeed: matProps.feedRate,
        stepOver: matProps.stepOver,
        bitDiameter: bit.diameter,
      });

      return {
        bit,
        bitMesh,
        segmentsForThreeJs,
        segmentsForGcodeFitted,
        originalLines: [[], path],
        rotation: {
          mode: 'repeatPassOverRotation',
          steps: 45 / 3, 
          startAngle: 0, 
          endAngle: -45,
        } 
      };
    }
  }
} 