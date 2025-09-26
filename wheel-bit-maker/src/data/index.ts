import * as THREE from 'three';
import * as model_0_13_Z112 from './m0.13/wheel/index';
import * as model_0_13_z14 from './m0.13/pinion/index';
import type { ToolpathSegment } from '../toolpath/morph-lines';


export interface IConstructProps {
  bit?: IBit; 
  material: TMaterial; 
  stockRadius: number;
}
export interface IConstructed {
  bit: IBit; 
  segmentsForThreeJs: any[];
  segmentsForGcodeFitted: ToolpathSegment[];
  originalLines: PointXYZ[][];
  bitMesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial, THREE.Object3DEventMap>;
  rotation?: {
    mode: TRotationMode;
    steps: number;
    startAngle: number;
    endAngle: number;
    angleAfterCompleted?: number;
  }
}
export interface IConstruction {
  name: string; 
  type: 'lines' | 'tooth'; 
  defaultBit: IBit;
  rotation?: {
    mode: TRotationMode;
    steps: number;
    startAngle: number;
    endAngle: number;
    angleAfterCompleted?: number;
  };
  construct: (props: IConstructProps) => IConstructed;
}

interface IModel {
  filename: string;
  getHowManyPasses: () => number;
  getPass: (n: number) => () => IConstruction;  
}
export const models: {[key: string]: IModel} = {
  "model_0_13_Z112": model_0_13_Z112,
  "model_0_13_z14": model_0_13_z14,
}