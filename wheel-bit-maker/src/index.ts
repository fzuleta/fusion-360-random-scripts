import fs from 'fs';
import path from 'path';
import { initialGCode, endGCode } from './helpers/gcode';
import { generateGCode } from './gcode-generator';
import { generateGCodeFromMorph, morphLines } from './morph-lines';

/**
 * Offsets each point outward from the surface by the tool radius along the
 * local outward normal.  The normal is taken as the right‑hand perpendicular
 * to the tangent (prev→next).  We flip the normal so its Y component is
 * positive, ensuring we always approach from the +Y half‑plane.
 */
const offsetLineConsideringBitRadius = (line: PointXY[], radius: number): PointXY[] => {
  return line;
  return line.map((p, i) => {
    const prev = line[i - 1];
    const next = line[i === line.length - 1 ? i - 1 : i + 1];

    if (!prev) {
      return { x: p.x - radius, y: p.y + radius}
    }
    // this is not really working

    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    // Right‑hand normal (rotate tangent clockwise)
    let nx =  ty / len;
    let ny = -tx / len;
    // Flip so normal always points into +Y half‑plane
    if (ny < 0) { nx = -nx; ny = -ny; }
    return { x: p.x + nx * radius, y: p.y + ny * radius };
  });
}
const bitRadius = 3.175 / 2;
const stepOver = 0.25

const init = async () => {
  const lines: string[] = [];

  initialGCode({ lines, toolNumber: 1, spindleSpeed: 30_000 });
const lineA = offsetLineConsideringBitRadius([{ x: 0, y: 3 }, { x: -25.6, y: 3 }], bitRadius);
const lineB = offsetLineConsideringBitRadius(
  [
    { x: 0, y: 1.3 },
    { x: -0.42, y: 1.3 },
    { x: -0.42, y: 0.7 },
    { x: -20, y: 0.7 },
    { x: -25.6, y: 3 }
  ],
  bitRadius
);
  const morph = morphLines({ lineA, lineB, stepOver });
   
  const motionLines = generateGCodeFromMorph({
    morphLines: morph, 
    stockRadius: 3,
    bitRadius,
    ZToCut: 0,
    rotationSteps: 1000,
    feedRate: 50,
  });
  lines.push(...motionLines);

  endGCode(lines);

  const gcode = lines.join('\n');
  // console.log(gcode);

  const outDir = path.resolve(__dirname, '..', 'dist');
  (fs.existsSync(outDir)) && fs.rmSync(outDir, { recursive: true, force: true }); 
  fs.mkdirSync(outDir);
  [gcode].forEach((it, i)=>{
    if (!it){ return; }
    const filename = `file.gcode`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, it);
    console.log(`✅ G-code saved to ${outPath}`);
  })
};

init();