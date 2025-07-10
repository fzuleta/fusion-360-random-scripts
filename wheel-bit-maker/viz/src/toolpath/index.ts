import { morphLines, offsetLineConsideringBitRadius } from "./morph-lines";

export interface ILinesGotten {
  originalLines: PointXY[][]
  morphedLines: PointXY[][]
}
export const getLines = (props: { bitRadius: number; stepOver: number, lineStart: PointXY[], lineA: PointXY[], lineB: PointXY[]}): ILinesGotten => {
  const {bitRadius, stepOver} = props;
  
  const originalLines: PointXY[][] = [props.lineStart, props.lineA, props.lineB];

  const lineStart = JSON.parse(JSON.stringify(props.lineStart)) as PointXY[];
  const lineA = JSON.parse(JSON.stringify(props.lineA)) as PointXY[];
  const lineB = JSON.parse(JSON.stringify(props.lineB)) as PointXY[];
  
  lineStart.forEach(it => it.y += bitRadius);
  lineA.forEach(it => it.y += bitRadius);
  
  // let i = 0;
  // i=0;  lineB[i].y += bitRadius;
  // i++;  lineB[i].x -= bitRadius; lineB[i].y += bitRadius;
  // i++;  lineB[i].x -= bitRadius; lineB[i].y += bitRadius;
  // i++;  lineB[i].x += bitRadius; lineB[i].y += bitRadius;
  // i++;  lineB[i].y += bitRadius;


  const morphedLines = morphLines({ lineA, lineB, stepOver, bitRadius });
  morphedLines.unshift(offsetLineConsideringBitRadius(lineStart, bitRadius));
  return {
    originalLines,
    morphedLines,
  }
}