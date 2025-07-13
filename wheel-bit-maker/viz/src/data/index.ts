import * as model_0_13_Z112 from './m0.13/wheel';
import * as model_0_13_z14 from './m0.13/pinion';

interface IModel {
  filename: string;
  getPasses: (stockRadius: number) => { lineStart: PointXYZ[], lineA: PointXYZ[], lineB: PointXYZ[], lineB_offset: PointXYZ[], bitRadius: number }[]
  points: ISegments;
}
export const models: {[key: string]: IModel} = {
  "model_0_13_Z112": model_0_13_Z112,
  "model_0_13_z14": model_0_13_z14,
}