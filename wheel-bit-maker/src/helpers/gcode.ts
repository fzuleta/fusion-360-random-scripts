export const initialGCode=(props: {
  lines: string[]
  toolNumber: number;
  spindleSpeed: number;
}) => {
  const {lines, toolNumber, spindleSpeed} = props;
  const add = (s: string) => lines.push(s);
  add(`G90 G94 G91.1 G40 G49 G17        ; Modal safe state`);
  add(`G21                              ; Metric mode`);
  add(`G28 G91 Z0.                      ; Home Z axis`);
  add(`G90                              ; Return to absolute mode`);
  add(`T${toolNumber} M6                ; Tool change`);
  add(`G54                              ; Use work coordinate system`);
  add(`G0 G43 Z15.45 H${toolNumber}     ; Tool length offset and retract`);
  add(`S${spindleSpeed} M3              ; Spindle on`);
  add(`M8                               ; Coolant on`);
  add(`G0 A0.                           ; Reset A-axis`);
  
  return lines;
}
export const endGCode=(lines: string[]) => {
  const add = (s: string) => lines.push(s);
  
  add(`;Finished, exit sequence:`);
  add(`;====================`);
  add(`G49              ; Cancel tool length offset`);
  add(`M9               ; Coolant OFF`);
  add(`M5               ; Spindle STOP`);
  add(`G28 G91 Z0.      ; Home Z axis`);
  add(`G90              ; Return to absolute mode`);
  add(`G0 A0.           ; Reset A-axis`);
  add(`G28 G91 X0. Y0.  ; Home X and Y axes`);
  add(`G90              ; Return to absolute mode`);
  add(`M30              ; End program and rewind`);
  return lines;
}