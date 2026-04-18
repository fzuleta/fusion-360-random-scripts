import type { IConstruction } from '../..';
import * as wheel from '../wheel';

export const filename = 'm=0.13 z=14.stl';

const getCustomToothPass = (): IConstruction => {
  const bottomCut = 2.0;
  const tipX = -0.335;
  const startOfTeethZ = bottomCut + 0.259;

  const leftProfile: ITeethPoint[] = [
    { // left base
      from: {   x: -1,     y: 0, z: bottomCut },
      to:   {   x: -0.223, y: 0, z: bottomCut },
    },
    { // from base to first arc
      from: {   x: -0.223, y: 0, z: bottomCut },
      to:   {   x: -0.223, y: 0, z: startOfTeethZ },
    },
    { // left first arc
      from:   { x: -0.223, y: 0, z: startOfTeethZ },
      to:     { x: -0.131, y: 0, z: startOfTeethZ + 0.085 },
      center: { x: -0.238, y: 0, z: startOfTeethZ + 0.109, anticlockwise: false },
    },
    { // left line between arcs
      from: { x: -0.131, y: 0, z: startOfTeethZ + 0.085 },
      to:   { x: -0.111,  y: 0, z: startOfTeethZ + 0.214 },
    },
    { // left tip to center 
      from:   { x: -0.111,  y: 0, z: startOfTeethZ + 0.214 },
      to:     { x: 0,   y: 0, z: startOfTeethZ + 0.302 },
      center: { x: 0,   y: 0, z: startOfTeethZ + 0.188, anticlockwise: true },
    },
  ];

  return wheel.createMirroredToothPass({
    leftProfile,
    tipX,
  });
};

export const getHowManyPasses = () => wheel.getHowManyPasses();

export const getPass = (n: number) => {
  switch (n) {
    case 0:
    case 1:
    case 2:
      return wheel.getPass(n);
    case 3:
      return getCustomToothPass;
    default:
      throw new Error('Pass doesnt exist');
  }
};