declare interface PointXYZ{
  x: number;
  y: number;
  z: number;
}
declare interface PointXYA {
  x: number;
  y: number;
  a: number;
}

declare interface MillingConfig {
  stockRadius: number;     // mm
  stockLength: number;     // mm
  toolRadius: number;      // mm
  stepOver: number;        // mm
  spindleSpeed: number;    // RPM
  plungeZ?: number;        // Defaults to Z = 0
  toolNumber: number;
}

declare interface ISegments {
  all: Segment[], left: Segment[], right: Segment[]}

declare interface MillingJob {
  targetXY: PointXY[];
  config: MillingConfig;
}
type Segment = {
  type: 'line' | 'arc',
  from: THREE.Vector3,
  to: THREE.Vector3,
  center?: THREE.Vector3,
  anticlockwise?: boolean,
  length: number
};
declare type ITeethPoint =  {from: PointXYZ, to: PointXYZ, center?: PointXYZ & {anticlockwise?: boolean}}
