import * as THREE from 'three';
import * as model_0_13_Z112 from './m0.13/wheel/index';
import * as model_0_13_z14 from './m0.13/pinion/index';
import type { GCodeSettings, ToolpathSegment } from '../toolpath/morph-lines';

export type ToothPassVariant = 'leftThenRightPerAngle' | 'leftAcrossAllAnglesThenRight';

export type GCodeSettingsOverrides =
  Partial<Omit<GCodeSettings, 'safeRetract' | 'machineActions'>> & {
    safeRetract?: Partial<GCodeSettings['safeRetract']>;
    machineActions?: Partial<GCodeSettings['machineActions']>;
  };


export interface IConstructProps {
  bit?: IBit; 
  material: TMaterial; 
  stockRadius: number;
  toothPassVariant?: ToothPassVariant;
}
export interface IConstructed {
  bit: IBit; 
  segmentsForThreeJs: any[];
  segmentsForGcodeFitted: ToolpathSegment[];
  originalLines: PointXYZ[][];
  comparisonProfiles?: PointXYZ[][];
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
  defaultGcodeSettings?: GCodeSettingsOverrides;
  // rotation?: {
  //   mode: TRotationMode;
  //   steps: number;
  //   startAngle: number;
  //   endAngle: number;
  //   angleAfterCompleted?: number;
  // };
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