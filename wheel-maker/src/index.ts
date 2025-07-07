function generatePinionGcode({
  Z,
  module,
  stockRadius,
  toothWidth,
  safeX,
  safeY,
  safeZ,
  feedRate,
  spindleSpeed,
  toolNumber
}: {
  Z: number;
  module: number;
  stockRadius: number;
  toothWidth: number;
  safeX: number;
  safeZ: number;
  safeY: number;
  feedRate: number;
  spindleSpeed: number;
  toolNumber: number;
}): string {
  const pitchDiameter = Z * module;
  const anglePerTooth = 360 / Z;
  const lines: string[] = [];

  lines.push(`G90 G94 G17 G21               ; Absolute positioning, feed/min, XY plane, mm units`);
  lines.push(`G40 G49 G80                   ; Cancel cutter radius comp, tool length offset, and canned cycles`);
  lines.push(`G54                           ; Use work coordinate system G54`);
  lines.push(`T${toolNumber} M6             ; Tool change`);
  lines.push(`G43 H${toolNumber} Z${safeZ}  ; Apply tool length offset and move Z`); 
  lines.push(`G0 X${safeX} Y${safeY}        ; Retract XY to safe `);
  lines.push(`M3 S${spindleSpeed}           ; Start spindle clockwise at speed`);

  for (let i = 0; i < Z; i++) {
    const angle = i * anglePerTooth;
    lines.push(`(Tooth ${i + 1})`);
    lines.push(`G0 A${angle.toFixed(4)}     ; Rotate A-axis to tooth angle`);
    lines.push(`G0 X0 Y${safeY} Z${safeZ}   ; Move to safe approach position`);
    lines.push(`G1 Y0 F${feedRate}          ; Feed into tooth along Y-axis`);
    lines.push(`G1 X${toothWidth} F${feedRate} ; Cut tooth width along X-axis`);
    lines.push(`G0 Y${safeY}                ; Retract along Y to safe position`);
  }

  lines.push(`G0 Z${safeZ}       ; Retract Z to safe height`);
  lines.push(`M5                ; Stop spindle`);
  lines.push(`G49`);
  lines.push(`M30               ; End program`);

  return lines.join('\n');
}

const init = async () => {
  const gcode = generatePinionGcode({
    Z: 112,
    module: 0.13,
    stockRadius: 3,       // in mm (example: adjust to your stock size)
    toothWidth: 0.25,     // in mm (example: depends on cutter/tool)
    safeX: 0,             // in mm (must be less than -stockRadius)
    safeY: -3,            // in mm (must be less than -stockRadius)
    safeZ: 10,            // in mm (safe retract height)
    feedRate: 30,         // mm/min
    spindleSpeed: 5000,   // RPM
    toolNumber: 1
  });

  console.log(gcode);
};
init()