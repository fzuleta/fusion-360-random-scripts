import { morphLines, offsetLineConsideringBitRadius } from "./morph-lines";

export interface ILinesGotten {
  originalLines: PointXY[][]
  morphedLines: PointXY[][]
}
export const getLines = (props: { bitRadius: number; stockRadius: number; stepOver: number}): ILinesGotten => {
  const {bitRadius, stockRadius, stepOver} = props;
  
  const safeX = (bitRadius + (bitRadius*0.1));
  const safeY = (stockRadius + bitRadius + 2);
  const originalLineStart = [
    { x: safeX, y: safeY }, 
    { x: safeX, y: stockRadius }, 
    { x: 0, y: stockRadius }
  ];
  const originalLineA = [
    { x: 0, y: stockRadius }, 
    { x: -25.6, y: stockRadius }
  ];
  const originalLineB =  
    [
      { x: 0, y: 1.3 },
      { x: -0.42, y: 1.3 },
      { x: -0.42, y: 0.7 },
      { x: -10, y: 0.7 },
      { x: -15.6, y: stockRadius }
    ];
  const originalLines: PointXY[][] = [originalLineStart, originalLineA, originalLineB];

  const lineStart = JSON.parse(JSON.stringify(originalLineStart)) as PointXY[];
  const lineA = JSON.parse(JSON.stringify(originalLineA)) as PointXY[];
  const lineB = JSON.parse(JSON.stringify(originalLineB)) as PointXY[];
  
  lineStart.forEach(it => it.y += bitRadius);
  lineA.forEach(it => it.y += bitRadius);
  
  let i = 0;
  i=0;  lineB[i].y += bitRadius;
  i++;  lineB[i].x -= bitRadius; lineB[i].y += bitRadius;
  i++;  lineB[i].x -= bitRadius; lineB[i].y += bitRadius;
  i++;  lineB[i].x += bitRadius; lineB[i].y += bitRadius;
  i++;  lineB[i].y += bitRadius;


  const morphedLines = morphLines({ lineA, lineB, stepOver, bitRadius });
  morphedLines.unshift(offsetLineConsideringBitRadius(lineStart, bitRadius));
  return {
    originalLines,
    morphedLines,
  }
}