import { morphLines } from "./morph-lines";

export interface ILinesGotten {
  originalLines: PointXYZ[][]
  morphedLines: PointXYZ[][]
}
export const getLines = (props: { 
  bit: IBit; 
  stepOver: number, 
  lineStart: PointXYZ[], 
  lineA: PointXYZ[], 
  lineB: PointXYZ[],
  lineB_offset: PointXYZ[];
}): ILinesGotten => {
  const {bit, stepOver, lineA, lineB_offset} = props;
  const originalLines: PointXYZ[][] = [props.lineStart, props.lineA, props.lineB];
  const lineStart = JSON.parse(JSON.stringify(props.lineStart)) as PointXYZ[]; 
  const morphedLines = morphLines({ lineA, lineB: lineB_offset, stepOver, bitRadius: bit.diameter * 0.5 });
  morphedLines.unshift(lineStart);
  return {
    originalLines,
    morphedLines,
  }
}