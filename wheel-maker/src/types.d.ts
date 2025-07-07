export interface ITeeth {
  Z: number;              // Number of teeth
  module: number;         // Gear module
  stockRadius: number;    // Radius of round stock
  toothWidth: number;     // How far to move in X for the tooth face
  safeZ: number;          // Retract height in Z
  safeY: number;          // Safe Y (e.g. -stockRadius)
  feedRate: number;
  spindleSpeed: number;
}