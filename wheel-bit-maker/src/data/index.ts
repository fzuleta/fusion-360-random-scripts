import * as THREE from 'three';
import * as model_0_13_Z112 from './m0.13/wheel';
import * as model_0_13_z14 from './m0.13/pinion';
import type { ToolpathSegment } from '../toolpath/morph-lines';

export type IPass = {
  bit: IBit, 
  bitMesh: THREE.Mesh
  originalLines: PointXYZ[][], 
  segmentsForThreeJs: TVector3[][],
  segmentsForGcodeFitted  : ToolpathSegment[];
}

interface IModel {
  filename: string;
  getPasses: (stockRadius: number, stepOver: number, feedRate: number) => IPass[];
  points: ISegments;
}
export const models: {[key: string]: IModel} = {
  "model_0_13_Z112": model_0_13_Z112,
  "model_0_13_z14": model_0_13_z14,
}