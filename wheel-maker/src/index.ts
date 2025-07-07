import * as helpers from './helpers'; 
import fs from 'fs';
import path from 'path';

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
  add(`G90 G94 G91.1 G40 G49 G17        ; Modal safe state`);
  add(`G21                              ; Metric mode`);
  add(`G28 G91 Z0.                      ; Home Z axis`);
  add(`G90                              ; Return to absolute mode`);
  add(`T${toolNumber} M6                ; Tool change`);
  add(`G54                              ; Use work coordinate system`);
  add(`G0 G43 Z${safeZ} H${toolNumber}  ; Tool length offset and retract`);
  add(`S${spindleSpeed} M3              ; Spindle on`);
  add(`M8                               ; Coolant on`);
  add(`G0 A0.                           ; Reset A-axis`);
  add(`G0 X${safeX} Y${safeY}           ; Move to safe lateral position`);

  add(`;This sequence will repeat ${Z} times`);
  for (let i = 0; i < Z; i++) {
    add(`; ${i}:`);
    const angle = i * anglePerTooth;
    add(`(Tooth ${i + 1})`);
    add(`G0 Y${safeY}                    ; Go to safe Y`); 
    add(`G0 X${safeX} Z0                 ; Go to safe X and Z0`);
    add(`G0 A${angle.toFixed(4)}         ; Rotate A Axis by ${angle.toFixed(4)} degrees`);
    add(`G0 Y${radiusDf}                 ; Go to max depth it can go to`);
    add(`G1 X${finalXCut} F${feedRate}   ; CUT!!!!`);
    add(`G0 Y${safeY}                    ; Retract in Y`);
  }
  
  add(``);
  add(`;Finished, exit sequence:`);
  add(`;====================`);
  add(`G0 Y${safeY}                    ; Retract in Y`);
  add(`G49              ; Cancel tool length offset`);
  add(`M9               ; Coolant OFF`);
  add(`M5               ; Spindle STOP`);
  add(`G28 G91 Z0.      ; Home Z axis`);
  add(`G90              ; Return to absolute mode`);
  add(`G0 A0.           ; Reset A-axis`);
  add(`G28 G91 X0. Y0.  ; Home X and Y axes`);
  add(`G90              ; Return to absolute mode`);
  add(`M30              ; End program and rewind`);

  return lines.join('\n');
}

const init = async () => {
  // Argument parsing
  const args = process.argv.slice(2);
  const ZArg = args.find(arg => arg.startsWith("Z="));
  const zArg = args.find(arg => arg.startsWith("z="));
  const mArg = args.find(arg => arg.startsWith("m="));
  const module = mArg ? parseFloat(mArg.split("=")[1]) : undefined;

  if (!module) {
    console.error("Module required, Usage: npm run start -- m=0.13 Z=112 [z=14]");
    process.exit(1);
  }

  // Handler for pinion
  const handlePinion = () => {
    if (!zArg) {
      console.error("Usage: npm run mill:pinion -- z=6 m=0.13");
      process.exit(1);
    }
    const z = parseInt(zArg.split("=")[1], 10);
    const factors = helpers.getPinionFactors(z);
    const gcode = generatePinionGcode({
      factors,
      Z: z,
      module,
      toolNumber: 1,
      type: 'pinion'
    });
    return gcode;
  };

  // Handler for wheel
  const handleWheel = () => {
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
    const gcode = generatePinionGcode({
      factors,
      Z,
      module,
      toolNumber: 1,
      type
    });
    return gcode;
  };

  const Z = ZArg ? parseInt(ZArg.split("=")[1], 10) : undefined;
  const z = zArg ? parseInt(zArg.split("=")[1], 10) : undefined;

  // Main logic: dispatch to handlers
  const dataWheel = handleWheel();
  const dataPinion = !!z && handlePinion()

  const outDir = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }
  [dataWheel,dataPinion].forEach((it, i)=>{
    if (!it){ return; }
    const filename = `${i===0?'wheel-':'pinion-'}m${module}${Z && '-Z'+Z}${z && '-z'+z}.nc`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, it);
    console.log(`✅ G-code saved to ${outPath}`);
  })
};
init()