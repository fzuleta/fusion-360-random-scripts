import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GCODE_SETTINGS,
  generateGCodeFromSegments,
  getRotaryAngles,
  splitSegmentsIntoPasses,
  type GCodeSettings,
  type ToolpathSegment,
} from './morph-lines';
import { getPass as getWheelPass } from '../data/m0.13/wheel/index';

const baseSegments: ToolpathSegment[] = [
  {
    kind: 'plunge',
    pts: [{ x: 0, y: 0, z: -1 }],
    feed: 100,
  },
  {
    kind: 'cut',
    pts: [{ x: 0, y: 0, z: -1 }, { x: 2, y: 0, z: -1 }],
    feed: 250,
  },
];

const rotation = {
  mode: 'fullPassPerRotation' as const,
  steps: 1,
  startAngle: 0,
  endAngle: 0,
};

const makeBit = (spindleSpeed?: number): IBit => ({
  diameter: 3.175,
  height: 12,
  toolNumber: 7,
  material: {
    'A2-Rough': spindleSpeed === undefined
      ? ({ feedRate: 500, stepOver: 0.1 } as IBit['material'][TMaterial])
      : { spindleSpeed, feedRate: 500, stepOver: 0.1 },
  },
});

describe('generateGCodeFromSegments', () => {
  it('includes the configured end angle on partial rotary sweeps', () => {
    expect(getRotaryAngles({
      mode: 'repeatPassOverRotation',
      steps: 9,
      startAngle: 0,
      endAngle: -245,
    })).toEqual([0, -30.625, -61.25, -91.875, -122.5, -153.125, -183.75, -214.375, -245]);
  });

  it('avoids duplicating the start angle on full-turn sweeps', () => {
    expect(getRotaryAngles({
      mode: 'repeatPassOverRotation',
      steps: 45,
      startAngle: 0,
      endAngle: 360,
    }).at(-1)).toBe(352);
  });

  it('matches the default golden output for the machine-specific post', () => {
    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
    });

    expect(gcode).toEqual([
      'G90 G94 G91.1 G40 G49 G17',
      'G21',
      'G28 G91 Z0.',
      'G90',
      '( TOOL 7  Ø3.175 CVD-DIA )',
      'T7 M6',
      'S12000 M3',
      'G04 P1.0',
      'M8',
      'G54',
      'G43 Z0.0 H7',
      'G0 X0.000 Y0.000 ; pre-position XY at safe Z',
      'G1 X0.000 Y0.000 Z-1.000 F100',
      'G1 X2.000 Y0.000 Z-1.000 F250',
      'M9',
      'M5',
      'G28 G91 Z0.',
      'G90',
      'G28 G91 X0. Y0.',
      'G90',
      'M30',
    ]);
  });

  it('matches the override golden output when machine-home moves are disabled', () => {
    const settings: GCodeSettings = {
      ...DEFAULT_GCODE_SETTINGS,
      machineActions: {
        homeZBeforeStart: false,
        homeZAfterEnd: false,
        homeXYAfterEnd: false,
        resetRotaryAfterEnd: false,
      },
    };

    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings,
    });

    expect(gcode).toEqual([
      'G90 G94 G91.1 G40 G49 G17',
      'G21',
      '( TOOL 7  Ø3.175 CVD-DIA )',
      'T7 M6',
      'S12000 M3',
      'G04 P1.0',
      'M8',
      'G54',
      'G43 Z0.0 H7',
      'G0 X0.000 Y0.000 ; pre-position XY at safe Z',
      'G1 X0.000 Y0.000 Z-1.000 F100',
      'G1 X2.000 Y0.000 Z-1.000 F250',
      'M9',
      'M5',
      'M30',
    ]);
  });

  it('throws when spindle speed is missing everywhere', () => {
    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(),
      segments: baseSegments,
    })).toThrow(/Spindle speed is required/);
  });

  it('throws when optional safe retract axes are non-finite', () => {
    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        safeRetract: { z: 30, x: Number.NaN },
      },
    })).toThrow(/safe retract X must be a finite number/);

    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        safeRetract: { z: 30, y: Number.POSITIVE_INFINITY },
      },
    })).toThrow(/safe retract Y must be a finite number/);
  });

  it('uses the post tool-number override when provided', () => {
    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        toolNumber: 12,
      },
    });

    expect(gcode).toContain('( TOOL 12  Ø3.175 CVD-DIA )');
    expect(gcode).toContain('T12 M6');
    expect(gcode).toContain('G43 Z0.0 H12');
  });

  it('throws when the post tool-number override is invalid', () => {
    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        toolNumber: 0,
      },
    })).toThrow(/Tool number must be a positive integer/);
  });

  it('only resets rotary after end when configured on a rotary job', () => {
    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      rotation,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        machineActions: {
          ...DEFAULT_GCODE_SETTINGS.machineActions,
          resetRotaryAfterEnd: true,
        },
      },
    });

    expect(gcode).toContain('G0 A0.');
  });

  it('keeps wheel tooth pass 4 as a rasterized linear toolpath', () => {
    const pass = getWheelPass(4)();
    const constructed = pass.construct({
      material: 'A2-Rough',
      stockRadius: 3,
      bit: pass.defaultBit,
    });

    expect(constructed.segmentsForGcodeFitted.some((seg) => seg.kind === 'arc')).toBe(false);

    const passes = splitSegmentsIntoPasses(constructed.segmentsForGcodeFitted);
    expect(passes.length).toBe(2);

    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: constructed.bit,
      segments: constructed.segmentsForGcodeFitted,
      rotation: constructed.rotation,
    });

    expect(gcode.some((line) => /^G[23]\b/.test(line))).toBe(false);
    expect(gcode.some((line) => /^G0 X.* Z0\.000$/.test(line))).toBe(false);
  });
});