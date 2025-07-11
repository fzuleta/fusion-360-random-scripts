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

declare interface MillingJob {
  targetXY: PointXY[];
  config: MillingConfig;
}
