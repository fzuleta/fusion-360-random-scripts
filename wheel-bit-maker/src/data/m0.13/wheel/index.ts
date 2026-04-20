import * as THREE from 'three';
import * as carbideBits from "../../../helpers/carbide-bits";
import { createBitMesh, generatePath, generateToothPath, tessellateToothProfile } from "../../helpers";
import { cloneSegment, convertPointToSegment, reverseSegmentList } from "../../../helpers";
import * as wheel from '../../../nihs_20_30/wheel'; 
import type { GCodeSettingsOverrides, IConstruction, IConstructProps, ToothPassVariant } from '../..';

export const filename = 'm=0.13 Z=112.stl';
const bits = carbideBits;
const DEFAULT_TOOTH_PASS_VARIANT: ToothPassVariant = 'leftAcrossAllAnglesThenRight';
const defaultPassPostSettings = ({
  x = 25,
  y = 25,
  z = 25,
  safeRetractX,
  safeRetractY,
  safeRetractZ,
}: {
  x?: number;
  y?: number;
  z?: number;
  safeRetractX?: number;
  safeRetractY?: number;
  safeRetractZ: number;
}): GCodeSettingsOverrides => ({
  startupPosition: { x, y, z },
  safeRetract: {
    ...(safeRetractX !== undefined ? { x: safeRetractX } : {}),
    ...(safeRetractY !== undefined ? { y: safeRetractY } : {}),
    z: safeRetractZ,
  },
});

export const getHowManyPasses = () => 4;
export const getPass = (n: number) => {
  switch (n){
    case 0: return pass0;  
    case 1: return pass1;
    case 2: return pass2;
    case 3: return pass3;
    default:
      throw new Error('Pass doesnt exist');
  }
}

export const getLeftRight = (offsetX: number = 0.5, _points: Segment[]) => {
  if (_points.length < 4) {
    throw new Error(`getLeftRight requires at least 4 segments, got ${_points.length}`);
  }

  const midIndex = Math.floor(_points.length / 2);
  const leftSource = _points.slice(1, midIndex);
  const rightSource = _points.slice(midIndex, _points.length - 1);

  if (leftSource.length === 0 || rightSource.length === 0) {
    throw new Error(`getLeftRight could not derive left/right flanks from ${_points.length} segments`);
  }

  const left = leftSource.map(it => convertPointToSegment(cloneSegment(it)));
  let p0 = cloneSegment(leftSource[0]);
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
  const rawRight = rightSource.map(cloneSegment); 
  const rawRightReversed = reverseSegmentList(rawRight); 
  const right = rawRightReversed.map(convertPointToSegment);

  // Add the little vertical “stub” as before (already points the right way)
  p0 = cloneSegment(_points[_points.length - 1]);
  p0.to = p0.from.clone();
  p0.from = p0.from.clone().add(new THREE.Vector3(offsetX, 0, 0));
  right.unshift(p0);

  return {left, right};
}

export const appendTipCleanupToRightFlank = (
  left: Segment[],
  right: Segment[],
  cleanupLength: number,
) => {
  const tipPoint = left.at(-1)?.to;
  if (!tipPoint) {
    throw new Error('Could not determine tooth tip for cleanup pass');
  }

  return [
    ...right,
    convertPointToSegment({
      from: { x: tipPoint.x, y: tipPoint.y, z: tipPoint.z },
      to: { x: tipPoint.x + cleanupLength, y: tipPoint.y, z: tipPoint.z },
    }),
  ];
}

export const createMirroredToothPass = ({
  bit = bits.HARVEYTOOLS_4F_3_175mm_73125_C3,
  leftProfile,
  name = '3. Tooth',
  safeRetractZ = 3,
  startAngle = 0,
  endAngle = -45,
  steps = 45 / 3,
  tipCleanupLength = -0.1,
  tipX = 0,
}: {
  bit?: IBit;
  leftProfile: ITeethPoint[];
  name?: string;
  safeRetractZ?: number;
  startAngle?: number;
  endAngle?: number;
  steps?: number;
  tipCleanupLength?: number;
  tipX?: number;
}): IConstruction => {
  const translateX = (pt: PointXYZ): PointXYZ => ({
    ...pt,
    x: pt.x + tipX,
  });

  const mirrorPointX = (pt: PointXYZ, axisX: number): PointXYZ => ({
    ...pt,
    x: 2 * axisX - pt.x,
  });

  const mirrorSegmentX = (segment: ITeethPoint, axisX: number): ITeethPoint => ({
    from: mirrorPointX(segment.to, axisX),
    to: mirrorPointX(segment.from, axisX),
    ...(segment.center ? { center: mirrorPointX(segment.center, axisX) } : {}),
  });

  const pts = leftProfile.map((segment) => ({
    from: translateX(segment.from),
    to: translateX(segment.to),
    ...(segment.center ? { center: translateX(segment.center) } : {}),
  }));

  const mirrorAxisX = pts.at(-1)?.to.x;
  if (mirrorAxisX === undefined) {
    throw new Error('Could not determine tooth mirror axis');
  }

  const mirroredFlank = pts
    .slice(1)
    .reverse()
    .map((segment) => mirrorSegmentX(segment, mirrorAxisX));

  const closingBaseStart = mirroredFlank.at(-1)?.to;
  const closingBaseEnd = pts[0]?.from;
  if (!closingBaseStart || !closingBaseEnd) {
    throw new Error('Could not determine tooth closing base');
  }

  pts.push(
    ...mirroredFlank,
    {
      from: { ...closingBaseStart },
      to: { ...closingBaseEnd },
    }
  );

  const comparisonProfile = tessellateToothProfile(pts, 0.01);

  const _points: Segment[] = pts.map((it) => convertPointToSegment(it));
  const { left, right } = getLeftRight(0.5, _points);
  const rightWithTipCleanup = appendTipCleanupToRightFlank(left, right, tipCleanupLength);

  const points: ISegments = {
    all: _points.map((it) => convertPointToSegment(cloneSegment(it))),
    left,
    right: rightWithTipCleanup,
  };

  return {
    name,
    type: 'tooth',
    defaultBit: bit,
    defaultGcodeSettings: defaultPassPostSettings({ safeRetractZ }),
    construct: (props: IConstructProps) => {
      const material = props.material;
      const toothPassVariant = props.toothPassVariant ?? DEFAULT_TOOTH_PASS_VARIANT;
      const b: IBit = props.bit || bit;
      const bitMesh = createBitMesh(b);
      const matProps = b.material[material];
      if (!matProps) {
        alert('Material not found');
        throw new Error('Material not found');
      }
      const { path } = wheel.getMesh(points, matProps.stepOver, bitMesh);

      const {
        segmentsForThreeJs,
        segmentsForGcodeFitted,
      } = generateToothPath(path, {
        stepOver: matProps.stepOver,
        stepOverIsMM: true,
        alongMaxSegMM: 0.015,
        arcResMM: 0.01,
        baseFeed: matProps.feedRate,
        bitDiameter: b.diameter,
      });

      return {
        bit: b,
        bitMesh,
        segmentsForThreeJs,
        segmentsForGcodeFitted,
        originalLines: [[], path],
        comparisonProfiles: [comparisonProfile],
        rotation: {
          mode: toothPassVariant === 'leftAcrossAllAnglesThenRight'
            ? 'repeatPassOverRotation'
            : 'fullPassPerRotation',
          steps,
          startAngle,
          endAngle,
        }
      };
    }
  };
}

const pass0 = (): IConstruction => { 
  const bit = bits.HARVEYTOOLS_4F_3_175mm_73125_C3;
  const cutZ = -2.0;
  const z = cutZ;
  const stockDepth = -11;
  const stockRampDepth = stockDepth-0.3;
  // console.log('Getting m0.13 Z112') 
  const lineA = [ // the border of the stock
    { x: 3, y: 0, z }, // y: stockRadius + bitRadius
    { x: stockRampDepth, y: 0, z }// y: stockRadius + bitRadius
  ];
  const lineB =  // rough: leave extra support, only mill down to 1.1 mm here
    [
      { x: 3, y: 2.7, z },
      { x: -0.547, y: 2.7, z },
      { x: -0.547, y: 2.0, z },
      { x: stockDepth, y: 2.0, z },
      { x: stockRampDepth, y: 0, z }// y: stockRadius + bitRadius
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
    name: "0. Rough", 
    type: 'lines',
    defaultBit: bit,
    defaultGcodeSettings: defaultPassPostSettings({ safeRetractZ: -0.500 }),
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = b.diameter * 0.5; 
      const bitMesh = createBitMesh(b); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      return {
        bit: b,
        bitMesh,
        rotation: {
          mode: 'repeatPassOverRotation',
          steps: 360 / 12,
          startAngle: 0, 
          endAngle: 360
        }, 
        ...generatePath({
          stepOver: matProps.stepOver, 
          stepOverIsMM: true,
          alongMaxSegMM: 0.015,
          arcResMM: 0.01,
          lineA, 
          lineB, 
          stockRadius, 
          bit: b,
          feedRate: matProps.feedRate, 
          cutZ,
        }),
      }
    },
  }
} 

const pass1 = (): IConstruction => { 
  const bit = bits.HARVEYTOOLS_4F_3_175mm_73125_C3;   
  const cutZ = -2.0;
  const z = cutZ; 
  
  const lineA =  // the inner profile
    [
      { x: 2, y: 2.7, z }, 
      { x: -2.0, y: 2.7, z }, 
    ];
  const lineB = [ // the border of the stock
    { x: 2, y: 2, z: z }, 
    { x: -2.0, y: 2, z: z }
  ]; 

  const applyBitRadiusAndStockRadius = (bitRadius: number, stockRadius: number) => {
    const lA = JSON.parse(JSON.stringify(lineA));
    const lB = JSON.parse(JSON.stringify(lineB)); 
    void stockRadius;

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
    name: "1. Side flatten", 
    type: 'lines',
    defaultBit: bit,
    defaultGcodeSettings: defaultPassPostSettings({ safeRetractZ: z }),
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = b.diameter * 0.5; 
      const bitMesh = createBitMesh(b); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      // this magic angle was discovered in illustrator by rotating the points on the center
      const endAngle = -360 + 128; // - means towards us in the elara
      return {
        bit: b,
        bitMesh,
        rotation: {
          mode: 'repeatPassOverRotation',
          steps: Math.round(Math.abs(endAngle / 12)),
          startAngle: 0, 
          endAngle,
        }, 
        ...generatePath({
          stepOver: matProps.stepOver, 
          stepOverIsMM: true,
          alongMaxSegMM: 0.015,
          arcResMM: 0.01,
          lineA, 
          lineB, 
          stockRadius, 
          bit: b,
          feedRate: matProps.feedRate, 
          cutZ,
        }),
      }
    },
  }
} 
const pass2 = (): IConstruction => { 
  const bit = bits.HARVEYTOOLS_4F_3_175mm_73125_C3; 
  const cutZ= 2.0;
  const z = cutZ; 
  
  const lineA = [
      { x: 2.0,     y: 0,   z },
      { x: 0,       y: 0,   z },
      { x: -2.0,    y: 0.21,   z },
    ];
  const lineB = [
    { x: 2,  y: -2,   z },
    { x: -2,  y: -2,   z },
  ]; 

  const applyBitRadiusAndStockRadius = (bitRadius: number, stockRadius: number) => {
    const lA = JSON.parse(JSON.stringify(lineA));
    const lB = JSON.parse(JSON.stringify(lineB)); 
    void stockRadius;

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
    name: "2. Relief angle", 
    type: 'lines',
    defaultBit: bit,
    defaultGcodeSettings: defaultPassPostSettings({ safeRetractZ: z }),
    construct: (props: IConstructProps) => {
      const { stockRadius, material } = props;
      const b: IBit = props.bit || bit;
      const bitRadius = b.diameter * 0.5; 
      const bitMesh = createBitMesh(b); 
      const matProps = b.material[material];
      if (!matProps) { 
        alert('Material not found'); 
        throw new Error('Material not found')
      }
      const {lineA, lineB} = applyBitRadiusAndStockRadius(bitRadius, stockRadius);
      return {
        bit: b,
        bitMesh,
        ...generatePath({
          stepOver: matProps.stepOver, 
          stepOverIsMM: true,
          alongMaxSegMM: 0.015,
          arcResMM: 0.01,
          lineA, 
          lineB, 
          stockRadius, 
          bit: b,
          feedRate: matProps.feedRate, 
          cutZ, 
          passDirection: 'bottom-to-top' as any,
        })
      }
    },
  }
} 
const pass3 = (): IConstruction => {
  const bottomCut = 2.0;
  const tipX = -0.335;
  const startOfTeethZ = bottomCut + 0.259;

  const leftProfile: ITeethPoint[] = [
    { // left base
      from: {   x: -1,     y: 0, z: bottomCut },
      to:   {   x: -0.208, y: 0, z: bottomCut },
    },
    { // from base to first arc
      from: {   x: -0.209, y: 0, z: bottomCut },
      to:   {   x: -0.209, y: 0, z: startOfTeethZ },
    },
    { // left first arc
      from:   { x: -0.209, y: 0, z: startOfTeethZ },
      to:     { x: -0.099, y: 0, z: startOfTeethZ + 0.205 },
      center: { x: -0.359, y: 0, z: startOfTeethZ + 0.212, anticlockwise: false },
    },
    { // left line between arcs
      from: { x: -0.099,  y: 0, z: startOfTeethZ + 0.205 },
      to:   { x: -0.099,  y: 0, z: startOfTeethZ + 0.239 },
    },
    { // left tip to center 
      from:   { x: -0.099,  y: 0, z: startOfTeethZ + 0.239 },
      to:     { x: 0,   y: 0, z: startOfTeethZ + 0.335 },
      center: { x: 0,   y: 0, z: startOfTeethZ + 0.235, anticlockwise: true },
    },
  ];

  return createMirroredToothPass({
    leftProfile,
    tipX,
  });
} 