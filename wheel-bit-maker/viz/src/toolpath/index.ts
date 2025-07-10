import { morphLines } from "./morph-lines";

export const getLines = (props: { bitRadius: number; stepOver: number}) => {
  const {bitRadius, stepOver} = props;
  const lineA = [{ x: 0, y: 3 }, { x: -25.6, y: 3 }];
  const lineB = 
    [
      { x: 0, y: 1.3 },
      { x: -0.42, y: 1.3 },
      { x: -0.42, y: 0.7 },
      { x: -20, y: 0.7 },
      { x: -25.6, y: 3 }
    ];
  const originalLines: PointXY[][] = [lineA, lineB];
  const morphedLines = morphLines({ lineA, lineB, stepOver, bitRadius });
  return {
    originalLines,
    morphedLines,
  }
}