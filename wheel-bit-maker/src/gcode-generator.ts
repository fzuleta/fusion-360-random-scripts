import { planToolpath } from './motion-planner';
import { planScanlineRaster } from './scanline-raster'
export function generateGCode(job: MillingJob): string[] {
  const { config, targetXY } = job;
  const lines: string[] = [];

  // const { xyaPath } = planToolpath({
  //   targetPoints: targetXY,
  //   toolRadius: config.toolRadius,
  //   stepOver: config.stepOver,
  //   stockLength: config.stockLength,
  // });
  const { xyaPath } = planScanlineRaster({
    targetPoints: targetXY,
    toolRadius: 3.175 * 0.5,
    stepOver: 0.1,
    stockLength: 40,
  });
  for (const { x, y, a } of xyaPath) {
    lines.push(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} A${a.toFixed(3)}`);
  }

  return lines;
}