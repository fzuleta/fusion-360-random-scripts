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
import { buildRasterPath } from '../nihs_20_30/wheel';

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
  brand: 'GENERIC',
  label: "",
  description: "",
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
      'G0 X50.000 Y50.000 Z0.000 ; startup park from work offset',
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
      'G0 X50.000 Y50.000 Z0.000 ; startup park from work offset',
      'G43 Z0.0 H7',
      'G0 X0.000 Y0.000 ; pre-position XY at safe Z',
      'G1 X0.000 Y0.000 Z-1.000 F100',
      'G1 X2.000 Y0.000 Z-1.000 F250',
      'M9',
      'M5',
      'M30',
    ]);
  });

  it('retracts to safe Z before lateral rapid moves', () => {
    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: [
        {
          kind: 'plunge',
          pts: [{ x: -16.989, y: 5.579, z: -0.5 }],
          feed: 100,
        },
        {
          kind: 'cut',
          pts: [
            { x: -16.989, y: 5.579, z: -0.5 },
            { x: -17.0, y: 5.588, z: -0.5 },
          ],
          feed: 250,
        },
        {
          kind: 'rapid',
          pts: [{ x: -17.0, y: 3.587, z: -0.5 }],
        },
      ],
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        machineActions: {
          homeZBeforeStart: false,
          homeZAfterEnd: false,
          homeXYAfterEnd: false,
          resetRotaryAfterEnd: false,
        },
      },
    });

    expect(gcode).toContain('G0 Z0.0');
    expect(gcode).toContain('G0 X-17.000 Y3.587 Z0.000');
    expect(gcode).not.toContain('G0 X-17.000 Y3.587 Z-0.500');
  });

  it('skips planner clearance-lane rapids when a global safe retract Y is configured', () => {
    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: [
        {
          kind: 'plunge',
          pts: [{ x: -16.987, y: 4.581, z: -0.5 }],
          feed: 100,
        },
        {
          kind: 'cut',
          pts: [
            { x: -16.987, y: 4.581, z: -0.5 },
            { x: -17.0, y: 4.588, z: -0.5 },
          ],
          feed: 250,
        },
        {
          kind: 'rapid',
          pts: [{ x: -17.0, y: 3.587, z: -0.5 }],
        },
      ],
      rotation: {
        mode: 'fullPassPerRotation',
        steps: 2,
        startAngle: 0,
        endAngle: 8,
      },
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        safeRetract: { z: 0, y: 5 },
        machineActions: {
          homeZBeforeStart: false,
          homeZAfterEnd: false,
          homeXYAfterEnd: false,
          resetRotaryAfterEnd: false,
        },
      },
    });

    expect(gcode).toContain('G0 Z0.0');
    expect(gcode).toContain('G0 X-17.000 Y5.000 Z0.000');
    expect(gcode).not.toContain('G0 X-17.000 Y3.587 Z0.000');
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

  it('uses the configured startup park before applying tool length compensation', () => {
    const gcode = generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        startupPosition: { x: 12.5, y: 34.25, z: 17.5 },
      },
    });

    expect(gcode).toContain('G0 X12.500 Y34.250 Z17.500 ; startup park from work offset');
    expect(gcode).toContain('G43 Z17.5 H7');
    expect(gcode).toContain('G0 X0.000 Y0.000 ; pre-position XY at safe Z');
  });

  it('throws when startup park axes are non-finite', () => {
    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        startupPosition: { x: Number.NaN, y: 50, z: 25 },
      },
    })).toThrow(/startup position X must be a finite number/);

    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        startupPosition: { x: 50, y: Number.POSITIVE_INFINITY, z: 25 },
      },
    })).toThrow(/startup position Y must be a finite number/);

    expect(() => generateGCodeFromSegments({
      material: 'A2-Rough',
      bit: makeBit(12000),
      segments: baseSegments,
      settings: {
        ...DEFAULT_GCODE_SETTINGS,
        startupPosition: { x: 50, y: 50, z: Number.NaN },
      },
    })).toThrow(/startup position Z must be a finite number/);
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

  it('mirrors the right tooth raster order so it starts from the far side', () => {
    const point = { x: 10, y: 0, z: 2 } as TVector3;

    expect(buildRasterPath([point], 1, 0.5, 'L2R').map(({ x, y, z }) => ({ x, y, z }))).toEqual([
      { x: 10, y: -0.5, z: 2 },
      { x: 10, y: 0.5, z: 2 },
      { x: 9, y: 0.5, z: 2 },
      { x: 9, y: -0.5, z: 2 },
    ]);

    expect(buildRasterPath([point], 1, 0.5, 'R2L').map(({ x, y, z }) => ({ x, y, z }))).toEqual([
      { x: 10, y: 0.5, z: 2 },
      { x: 10, y: -0.5, z: 2 },
      { x: 11, y: -0.5, z: 2 },
      { x: 11, y: 0.5, z: 2 },
    ]);
  });

  it('keeps wheel tooth pass 3 as a rasterized linear toolpath with legacy left-across-all-angles replay by default', () => {
    const pass = getWheelPass(3)();
    const constructed = pass.construct({
      material: 'brass-Rough',
      stockRadius: 3,
      bit: pass.defaultBit,
    });

    expect(constructed.segmentsForGcodeFitted.some((seg) => seg.kind === 'arc')).toBe(false);
    expect(constructed.rotation?.mode).toBe('repeatPassOverRotation');

    const passes = splitSegmentsIntoPasses(constructed.segmentsForGcodeFitted);
    expect(passes.length).toBe(2);

    const gcode = generateGCodeFromSegments({
      material: 'brass-Rough',
      bit: constructed.bit,
      segments: constructed.segmentsForGcodeFitted,
      rotation: constructed.rotation,
    });

    expect(gcode.some((line) => /^G[23]\b/.test(line))).toBe(false);
    expect(gcode.some((line) => /^G0 X.* Z0\.000$/.test(line))).toBe(false);
  });

  it('allows wheel tooth pass 3 to switch to left-then-right-per-angle replay', () => {
    const pass = getWheelPass(3)();
    const constructed = pass.construct({
      material: 'brass-Rough',
      stockRadius: 3,
      bit: pass.defaultBit,
      toothPassVariant: 'leftThenRightPerAngle',
    });

    expect(constructed.rotation?.mode).toBe('fullPassPerRotation');
  });
});