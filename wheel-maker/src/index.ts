import * as helpers from './helpers';

/**
 Machine Kinematics
 Kinematics (elara2)		
  X	-200 to	0
  Y	0 to 173.45
  Z -135.131 to 0
  A 0 to 360 continius

  spindle is located on XYZ Facing down
  A is located parallel to X facing +

  G54 must be set to the center of the stock, 
  where X is at the stock start
  YZ are at the center of the stock cyclinder (center of A Axis)

  Spindle will cut at the left of the stock, 
  meaning Y0 being center of stock, spindle will cut at -Y
 */

function generatePinionGcode({
  factors,
  Z,
  module,
  toolNumber,
  type
}: {
  factors: helpers.Factors;
  Z: number;
  module: number;
  toolNumber: number;
  type: 'wheel' | 'wheel-to-mesh' | 'pinion';
}): string {
  const m = module;  
  const h=helpers.calculate_height_of_tooth(m, factors.Ha, factors.Hf)
  const ha=helpers.calculate_height_of_head(m, factors.Ha)
  const hf=helpers.calculate_height_of_foot(m, factors.Hf)
  const s=helpers.calculate_thickness_of_tooth(m, factors.S)
  const p=helpers.calculate_radius_of_fillet(m, factors.P)
  const c=helpers.calculate_root_clearance(m, factors.C)
  const d=helpers.calculate_primitive_diameter(m, Z)
  const da=helpers.calculate_head_diameter(m, Z, factors.Ha)
  const df=helpers.calculate_foot_diameter(m, Z, factors.Hf)
  const pa=helpers.calculate_angular_pitch(Z)

  const radiusDa=da/2
  const radiusDf=df/2

  const anglePerTooth = 360 / Z;
  const lines: string[] = [];

  const safeX = (0 + 10).toFixed(4);
  const safeY = (0 - radiusDa - 5).toFixed(4);
  const safeZ = (0 - radiusDa - 5).toFixed(4); // 5mm above the end of the stock
  const spindleSpeed = 10_000
  const feedRate = 30
  const finalXCut = -10 // to cut 10mm of stock
  const add = (s: string) => lines.push(s);

  add(`(Milling a ${type} with ${Z} teeth)`);
  add(`G90 G94 G17 G21               ; Absolute positioning, feed/min, XY plane, mm units`);
  add(`G40 G49 G80                   ; Cancel cutter radius comp, tool length offset, and canned cycles`);
  add(`G54                           ; Use work coordinate system G54`);
  add(`T${toolNumber} M6             ; Tool change`);
  add(`G43 H${toolNumber}           ; Apply tool length offset and move Z`); 
  add(`G0 X${safeX} Y${safeY}        ; Retract XY to safe `);
  add(`M3 S${spindleSpeed}           ; Start spindle clockwise at speed`);

  for (let i = 0; i < Z; i++) {
    const angle = i * anglePerTooth;
    add(`(Tooth ${i + 1})`);
    add(`G0 Y${safeY}                    ; Go to safe Y`); 
    add(`G0 X${safeX} Z0                 ; Go to safe X and Z0`);
    add(`G0 A${angle.toFixed(4)}         ; Rotate A Axis by ${angle.toFixed(4)} degrees`);
    add(`G0 Y${radiusDf}                 ; Go to max depth it can go to`);
    add(`G1 X${finalXCut} F${feedRate}   ; CUT!!!!`);
    add(`G0 Y${safeY}                    ; Retract in Y`);
  }
  add(`G0 Y${safeY}                    ; Retract in Y`);
  add(`G0 Z${safeZ}       ; Retract Z to safe height`);
  add(`M5                ; Stop spindle`);
  add(`G49`);
  add(`M30               ; End program`);

  return lines.join('\n');
}

const init = async () => {
  const args = process.argv.slice(2);
  const isPinion = args.includes("isPinion=true");
  const ZArg = args.find(arg => arg.startsWith("Z="));
  const zArg = args.find(arg => arg.startsWith("z="));
  const mArg = args.find(arg => arg.startsWith("m="));
  const module = mArg ? parseFloat(mArg.split("=")[1]) : undefined;
  let gcode = ""
  if (!module) {
    console.error("Usage: npm run start -- m=0.13 Z=112 [z=14]");
    process.exit(1);
  }
  if (isPinion) {
    if (!zArg) {
      console.error("Usage: npm run mill:pinion -- z=6");
      process.exit(1);
    }
    const z = parseInt(zArg.split("=")[1], 10);
    const factors = helpers.getPinionFactors(z);
    gcode = generatePinionGcode({
      factors,
      Z: z,
      module,
      toolNumber: 1,
      type: 'pinion'
    });
    console.log(gcode);
    return;
  } else {

    if (!ZArg) {
      console.error("Usage: npm run start -- m=0.13 Z=112 [z=14]"); 
      process.exit(1);
    }

    const Z = parseInt(ZArg.split("=")[1], 10);
    const z = zArg ? parseInt(zArg.split("=")[1], 10) : undefined;

    const factors = z !== undefined
      ? helpers.getWheelFactors(z)
      : helpers.getAloneWheelFactors(Z);

    const type = z !== undefined ? 'wheel' : 'wheel-to-mesh';

    gcode = generatePinionGcode({
      factors,
      Z,
      module,
      toolNumber: 1,
      type
    });
  }

  console.log(gcode);
};
init()