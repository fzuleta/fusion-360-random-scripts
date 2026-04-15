import React from 'react';
import * as THREE from 'three'; 
import styles from './overlay.module.scss'; 
import type { IConstructed } from '../data';
import type { GCodeSettings } from '../toolpath/morph-lines';

interface IProps {
  constructed?: IConstructed,
  toolpathGroupRef: React.RefObject<THREE.Group | null>,
  gcodeSettings: GCodeSettings,
  onGcodeSettingsChange: React.Dispatch<React.SetStateAction<GCodeSettings>>,
  defaultSpindleSpeed?: number,
}
export const Overlay = (props: IProps) => { 
  return !props.constructed ? null : <div className={styles.overlay}>
  <PostSettings {...props} />
  <Rotation {...props} />
  <Segments {...props} /> 
  <WhatIsThisProject /> 
  <Disclaimer />
  </div>
};

const PostSettings = (props: IProps) => {
  const { gcodeSettings, onGcodeSettingsChange, defaultSpindleSpeed } = props;

  const updateWorkOffset = (value: string) => {
    onGcodeSettingsChange(current => ({
      ...current,
      workOffset: value,
    }));
  };

  const updateRetractAxis = (axis: 'x' | 'y' | 'z', rawValue: string) => {
    onGcodeSettingsChange(current => {
      const nextSafeRetract = { ...current.safeRetract };

      if (rawValue.trim() === '') {
        if (axis !== 'z') {
          delete nextSafeRetract[axis];
        }
      } else {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) {
          return current;
        }
        nextSafeRetract[axis] = parsed;
      }

      return {
        ...current,
        safeRetract: nextSafeRetract,
      };
    });
  };

  const updateSpindleSpeed = (rawValue: string) => {
    onGcodeSettingsChange(current => {
      if (rawValue.trim() === '') {
        return {
          ...current,
          spindleSpeed: undefined,
        };
      }

      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        return current;
      }

      return {
        ...current,
        spindleSpeed: parsed,
      };
    });
  };

  const updateMachineAction = (action: keyof GCodeSettings['machineActions'], checked: boolean) => {
    onGcodeSettingsChange(current => ({
      ...current,
      machineActions: {
        ...current.machineActions,
        [action]: checked,
      },
    }));
  };

  return <details className={styles.accordion} open>
    <summary className={styles.summary}>Post Settings</summary>
    <div className={styles.accordionContent}>
      <div className={styles.inputGroup}>
        <div className={styles.inputRow}>
          <label>Offset</label>
          <input
            type="text"
            value={gcodeSettings.workOffset}
            onChange={(e) => updateWorkOffset(e.target.value.toUpperCase())}
            style={{ width: 96, textAlign: 'left' }}
          />
        </div>
        <div style={{ fontSize: '0.85em', color: '#999' }}>
          Use `G54`-`G59` or `G54.1 Pn`.
        </div>
      </div>

      <div className={styles.inputGroup}>
        <div className={styles.inputRow}>
          <label>RPM</label>
          <input
            type="number"
            step="1"
            min="1"
            value={gcodeSettings.spindleSpeed ?? ''}
            placeholder={defaultSpindleSpeed === undefined ? 'required' : String(defaultSpindleSpeed)}
            onChange={(e) => updateSpindleSpeed(e.target.value)}
          />
        </div>
        <div style={{ fontSize: '0.85em', color: '#999' }}>
          {defaultSpindleSpeed === undefined
            ? 'No bit/material default RPM is defined. Enter an explicit spindle speed to allow G-code export.'
            : `Leave blank to use the bit/material default of ${defaultSpindleSpeed} RPM.`}
        </div>
      </div>

      <div className={styles.inputGroup}>
        <div style={{ marginBottom: 6, fontWeight: 700, color: '#ddd' }}>Safe Retract</div>
        <div className={styles.inputRow}>
          <label>X</label>
          <input
            type="number"
            step="0.001"
            value={gcodeSettings.safeRetract.x ?? ''}
            placeholder="keep"
            onChange={(e) => updateRetractAxis('x', e.target.value)}
          />
          <label>Y</label>
          <input
            type="number"
            step="0.001"
            value={gcodeSettings.safeRetract.y ?? ''}
            placeholder="keep"
            onChange={(e) => updateRetractAxis('y', e.target.value)}
          />
          <label>Z</label>
          <input
            type="number"
            step="0.001"
            value={gcodeSettings.safeRetract.z}
            onChange={(e) => updateRetractAxis('z', e.target.value)}
          />
        </div>
        <div style={{ fontSize: '0.85em', color: '#999' }}>
          X/Y are optional park coordinates for rotary-safe retracts. Z is the required clearance height.
        </div>
      </div>

      <div className={styles.inputGroup}>
        <div style={{ marginBottom: 6, fontWeight: 700, color: '#ddd' }}>Machine Actions</div>
        <div className={styles.inputRow}>
          <label>
            <input
              type="checkbox"
              checked={gcodeSettings.machineActions.homeZBeforeStart}
              onChange={(e) => updateMachineAction('homeZBeforeStart', e.target.checked)}
            />
            &nbsp;Home Z before start
          </label>
        </div>
        <div className={styles.inputRow}>
          <label>
            <input
              type="checkbox"
              checked={gcodeSettings.machineActions.homeZAfterEnd}
              onChange={(e) => updateMachineAction('homeZAfterEnd', e.target.checked)}
            />
            &nbsp;Home Z after end
          </label>
        </div>
        <div className={styles.inputRow}>
          <label>
            <input
              type="checkbox"
              checked={gcodeSettings.machineActions.homeXYAfterEnd}
              onChange={(e) => updateMachineAction('homeXYAfterEnd', e.target.checked)}
            />
            &nbsp;Home X/Y after end
          </label>
        </div>
        <div className={styles.inputRow}>
          <label>
            <input
              type="checkbox"
              checked={gcodeSettings.machineActions.resetRotaryAfterEnd}
              onChange={(e) => updateMachineAction('resetRotaryAfterEnd', e.target.checked)}
            />
            &nbsp;Reset A to zero after end
          </label>
        </div>
        <div style={{ fontSize: '0.85em', color: '#999' }}>
          These defaults match your machine's post behavior, but they remain editable here for prove-out and recovery workflows.
        </div>
      </div>
    </div>
  </details>
}

const Segments = (props: IProps) => { 
  const [segments, setsegments] = React.useState<PointXYZ[][]>([]);
  const [start, setstart] = React.useState<PointXYZ[]>([]);
  const [second, setsecond] = React.useState<PointXYZ[]>([]);
  const [end, setend] = React.useState<PointXYZ[]>([]);

  const startRefs = React.useRef<THREE.Mesh[]>([]);
  const endRefs = React.useRef<THREE.Mesh[]>([]); 

  React.useEffect(() => {
    if (!props.constructed) { return setsegments([]); }
    const segments = props.constructed.originalLines;
    if (!segments || segments.length === 0) { return setsegments([]); }
    console.log('segments',segments)
    setsegments(segments);
    setstart(segments[0] ?? []);
    setsecond(segments[1] ?? []);
    setend(segments[segments.length - 1] ?? []);
  }, [props.constructed]);

  React.useEffect(() => {
    if (!props.toolpathGroupRef?.current) return;

    const group = props.toolpathGroupRef.current;

    // Remove old point meshes
    const oldMarkers = group.children.filter(c => c.userData.overlayMarker);
    oldMarkers.forEach(m => group.remove(m));

    startRefs.current = [];
    endRefs.current = [];

    const makeMarker = (p: PointXYZ, color: number, type: 'start' | 'end', index: number, size=0.05) => {
      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshStandardMaterial({ color, emissive: color });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(p.x, p.y, p.z);
      sphere.userData = { overlayMarker: true, type, index };
      group.add(sphere);
      if (type === 'start') {
        startRefs.current.push(sphere);
      } else {
        endRefs.current.push(sphere);
      }
    };

    start.forEach((p, i) => makeMarker(p, 0xffffff, 'start', i, 0.025));
    second.forEach((p, i) => makeMarker(p, 0xffffff, 'start', i)); 
    end.forEach((p, i) => makeMarker(p, 0xffff00, 'end', i));  
 

  }, [start, second, end, props.toolpathGroupRef ]);
return segments.length === 0 ? <></> : (
  <details className={styles.accordion}>
    <summary className={styles.summary}>📍 Segment Points</summary>
    <div className={styles.accordionContent}>
         
        <h4>Segment Endpoints</h4>
        <div className={styles.inputGroup}>
          {start.map((p, i) => (
            <div key={`start-${i}`} className={`${styles.inputRow} ${styles.startInputRow}`}>
              <label>X:</label>
              <input
                type="number"
                step="0.001"
                value={p.x.toFixed(3)}
                onChange={e => {
                  const newVal = parseFloat(e.target.value);
                  start[i] = { ...p, x: newVal };
                  setstart([...start]);
                }}
              />
              <label>Y:</label>
              <input
                type="number"
                step="0.001"
                value={p.y.toFixed(3)}
                onChange={e => {
                  const newVal = parseFloat(e.target.value);
                  start[i] = { ...p, y: newVal };
                  setstart([...start]);
                }}
              />
              <label>Z:</label>
              <input
                type="number"
                step="0.001"
                value={p.z.toFixed(3)}
                onChange={e => {
                  const newVal = parseFloat(e.target.value);
                  start[i] = { ...p, z: newVal };
                  setstart([...start]);
                }}
              />
            </div>
          ))}
        </div>
        <div className={styles.inputGroup}>
          {end.map((p, i) => (
            <div key={`end-${i}`} className={`${styles.inputRow} ${styles.endInputRow}`}>
              <label>X:</label>
              <input
                type="number"
                step="0.001"
                value={p.x.toFixed(3)}
                onChange={e => {
                  const newVal = parseFloat(e.target.value);
                  end[i] = { ...p, x: newVal };
                  setend([...end]);
                }}
              />
              <label>Y:</label>
              <input
                type="number"
                step="0.001"
                value={p.y.toFixed(3)}
                onChange={e => {
                  const newVal = parseFloat(e.target.value);
                  end[i] = { ...p, y: newVal };
                  setend([...end]);
                }}
              />
              <label>Z:</label>
              <input
                type="number"
                step="0.001"
                value={p.z.toFixed(3)}
                onChange={e => {
                  const newVal = parseFloat(e.target.value);
                  end[i] = { ...p, z: newVal };
                  setend([...end]);
                }}
              />
            </div>
          ))} 
      </div>
    </div>
  </details>
  );
}
const Rotation=(props: IProps) => {
   return <details className={styles.accordion} open>
    <summary className={styles.summary}>🌀 Rotation Info</summary>
    <div className={styles.accordionContent}>  
  
      {/* New Rotation Summary Section */} 
    <div style={{ marginBottom: '1rem', fontSize: '0.9em', color: '#aaa' }}>
      <strong>Rotation Strategy:</strong>{' '}

      {!props.constructed?.rotation && <>No Rotation</>}
      {props.constructed?.rotation && <>
        {props.constructed.rotation?.mode === 'noRotation' && 'fallback/default'}
        {props.constructed.rotation?.mode === 'fullPassPerRotation' && 'Do the entire path, then rotate. Repeat.'}
        {props.constructed.rotation?.mode === 'onePassPerRotation' && 'Each pass (cut-retract group) is done once per rotation step.'}
        {props.constructed.rotation?.mode === 'repeatPassOverRotation' && 'Each pass is repeated at every rotary step before moving to next.'}

        <br />
        <strong>Steps:</strong> {props.constructed.rotation.steps}
        <br />
        <strong>Angle Range:</strong> {props.constructed.rotation.startAngle}° to {props.constructed.rotation.endAngle}°
        {props.constructed.rotation.angleAfterCompleted !== undefined && (
          <>
            <br />
            <strong>Angle After Completion:</strong> {props.constructed.rotation.angleAfterCompleted}°
          </>
        )}
      </>}
    </div> 

      {/* Your input sections (start and end points) go here */}
    </div>
  </details> 
}
const WhatIsThisProject = () => {
  return (
    <details className={styles.accordion}>
      <summary className={styles.summary}>🙋🏼‍♂️ What is this project?</summary>
      <div className={styles.accordionContent}>
        <p>
          This tool is a visualizer and code generator for milling wheel or pinion cutters from a solid cylindrical stock. The setup assumes the stock is mounted on a rotary A-axis, which allows precise shaping of profiles using a side-cutting endmill.
        </p>
        <p>
          Each pass is visualized in 3D, and segments can be individually inspected or adjusted. This helps verify toolpaths and identify potential machining issues before running the program on an actual CNC machine.
        </p>
        <p>
          It's designed to support high-precision, low-tolerance manufacturing scenarios like horology — but can be adapted to any rotary milling workflow.
        </p>
        <p>
          The reason for this project is that Fusion 360's multiaxis CAM features did not allow for safe multi-pass operations on the fourth axis, often resulting in collisions with the stock. Other CAM alternatives that support this are prohibitively expensive. This tool fills that gap.
        </p>
      </div>
    </details>
  );
}
const Disclaimer=() => {
   return <details className={styles.accordion}>
    <summary className={styles.summary}>⚠️ Disclaimer</summary>
    <div className={styles.accordionContent}>
      <p>
        The output of this project is provided for educational and experimental use only. It is not guaranteed to be safe, accurate, or suitable for any specific purpose.
      </p>
      <p>
        By using this project or its output, you assume full responsibility for any consequences, including but not limited to equipment damage, manufacturing errors, or personal injury.
      </p>
      <p>
        The creator of this project disclaims all liability for any loss or damage, direct or indirect, resulting from the use or misuse of this code, designs, or generated files.
      </p>
      <p>
        Always verify and simulate toolpaths before running them on real machinery.
      </p>
    </div>
  </details> 
}