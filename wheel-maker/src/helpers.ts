export class Factors {
  constructor(
    public Ha: number, // Tooth head height coefficient
    public Hf: number, // Tooth foot height coefficient
    public P: number,  // Radius top of the tooth
    public S: number,  // Tooth thickness coefficient
    public C: number   // Height of bottom of tooth (also: bottom void coefficient)
  ) {}

  // Optionally, you can add methods here if needed
}
export function getPinionFactors(pinionZ: number): Factors {
  if (pinionZ === 6)  return new Factors(0.82, 1.60, 1.05, 1.10, 0.40);
  if (pinionZ === 7)  return new Factors(0.82, 1.65, 1.05, 1.10, 0.40);
  if (pinionZ === 8)  return new Factors(0.76, 1.70, 0.95, 1.10, 0.40);
  if (pinionZ === 9)  return new Factors(0.76, 1.725, 0.95, 1.10, 0.40);
  if (pinionZ === 10) return new Factors(0.76, 1.75, 0.95, 1.10, 0.40);
  if (pinionZ <= 20)  return new Factors(0.72, 1.80, 0.85, 1.10, 0.40);
  throw new Error("No data was provided in the NIHS docs for pinionZ > 20");
}

// used when meshing wheels to pinions
export function getWheelFactors(pinionZ: number): Factors {
  if (pinionZ === 6)  return new Factors(1.20, 1.40, 2.00, 1.60, 0.58);
  if (pinionZ === 7)  return new Factors(1.25, 1.35, 2.00, 1.60, 0.53);
  if (pinionZ === 8)  return new Factors(1.30, 1.30, 2.00, 1.60, 0.54);
  if (pinionZ === 9)  return new Factors(1.325, 1.275, 2.00, 1.60, 0.515);
  if (pinionZ === 10) return new Factors(1.35, 1.25, 2.00, 1.60, 0.49);
  if (pinionZ <= 20)  return new Factors(1.40, 1.20, 2.00, 1.60, 0.48);
  throw new Error("No data was provided in the NIHS docs for pinionZ > 20");
}

// Used for meshing wheels to wheels
export function getAloneWheelFactors(z: number): Factors {
  const Hf = 1.32; // for z >= 135
  let Ha: number;

  if (z === 8) {
    Ha = 1.16;
  } else if (z === 9) {
    Ha = 1.17;
  } else if (z >= 10 && z <= 11) {
    Ha = 1.19;
  } else if (z >= 12 && z <= 13) {
    Ha = 1.20;
  } else if (z >= 14 && z <= 16) {
    Ha = 1.22;
  } else if (z >= 7 && z <= 20) {
    Ha = 1.24;
  } else if (z >= 21 && z <= 25) {
    Ha = 1.26;
  } else if (z >= 26 && z <= 34) {
    Ha = 1.27;
  } else if (z >= 35 && z <= 54) {
    Ha = 1.29;
  } else if (z >= 55 && z <= 134) {
    Ha = 1.31;
  } else {
    throw new Error("z is out of range (must be 7 to 134)");
  }

  const P = 1.6 * Ha;
  const S = 1.41;
  const C = Hf - Ha;

  return new Factors(Ha, Hf, P, S, C);
}


export const calculate_height_of_tooth = (m: number, Ha: number, Hf: number) => m * (Ha + Hf) // h
export const calculate_height_of_head = (m: number, Ha: number) => m * Ha // ha
export const calculate_height_of_foot = (m: number, Hf: number) => m * Hf // hf
export const calculate_thickness_of_tooth = (m: number, S: number) => m * S // s
export const calculate_radius_of_fillet = (m: number, P: number) => m * P // p
export const calculate_root_radius = (m: number, Pf: number) => m * Pf // pf
export const calculate_root_clearance = (m: number, C: number) => m * C // c
export const calculate_primitive_diameter = (m: number, Z: number) => m * Z;
export const calculate_head_diameter = (m: number, Z: number, Ha: number) => m * (Z + 2 * Ha);
export const calculate_foot_diameter = (m: number, Z: number, Hf: number) => m * (Z - 2 * Hf);
export const calculate_angular_pitch = (Z: number) => (2 * Math.PI) / Z;
