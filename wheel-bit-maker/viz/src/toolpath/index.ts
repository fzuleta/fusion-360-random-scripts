import { morphLines, offsetLineConsideringBitRadius } from "./morph-lines";

export interface ILinesGotten {
  originalLines: PointXY[][]
  morphedLines: PointXY[][]
}
export const getLines = (props: { 
  bitRadius: number; 
  stepOver: number, 
  lineStart: PointXY[], 
  lineA: PointXY[], 
  lineB: PointXY[],
  lineB_offset: PointXY[];
}): ILinesGotten => {
  const {bitRadius, stepOver, lineA, lineB_offset} = props;
  
  const originalLines: PointXY[][] = [props.lineStart, props.lineA, props.lineB];

  const lineStart = JSON.parse(JSON.stringify(props.lineStart)) as PointXY[]; 
  
  
  // let i = 0;
  // i=0;  lineB[i].y += bitRadius;
  // i++;  lineB[i].x -= bitRadius; lineB[i].y += bitRadius;
  // i++;  lineB[i].x -= bitRadius; lineB[i].y += bitRadius;
  // i++;  lineB[i].x += bitRadius; lineB[i].y += bitRadius;
  // i++;  lineB[i].y += bitRadius;


  const morphedLines = morphLines({ lineA, lineB: lineB_offset, stepOver, bitRadius });
  morphedLines.unshift(offsetLineConsideringBitRadius(lineStart, bitRadius));
  return {
    originalLines,
    morphedLines,
  }
}