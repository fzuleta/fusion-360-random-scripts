import React from 'react';
import * as THREE from 'three'; 
import styles from './overlay.module.scss';
import type { IPass } from '../data';

interface IProps {
  pass?: IPass,
  toolpathGroupRef: React.RefObject<THREE.Group | null>,
}
export const Overlay = (props: IProps) => { 
  return !props.pass ? null : <div className={styles.overlay}>
  <Rotation {...props} />
  <Segments {...props} /> 
  </div>
};

const Segments = (props: IProps) => { 
  const [segments, setsegments] = React.useState<PointXYZ[][]>([]);
  const [start, setstart] = React.useState<PointXYZ[]>([]);
  const [second, setsecond] = React.useState<PointXYZ[]>([]);
  const [end, setend] = React.useState<PointXYZ[]>([]);

  const startRefs = React.useRef<THREE.Mesh[]>([]);
  const endRefs = React.useRef<THREE.Mesh[]>([]); 

  React.useEffect(() => {
    if (!props.pass) { return setsegments([]); }
    const segments = props.pass.originalLines;
    if (!segments || segments.length === 0) { return setsegments([]); }
    console.log('segments',segments)
    setsegments(segments);
    setstart(segments[0] ?? []);
    setsecond(segments[1] ?? []);
    setend(segments[segments.length - 1] ?? []);
  }, [props.pass]);

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
 

  }, [start, end, props.toolpathGroupRef ]);
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
 
    <>
      {/* New Rotation Summary Section */}
      {props.pass?.rotation && (
        <div style={{ marginBottom: '1rem', fontSize: '0.9em', color: '#aaa' }}>
          <strong>Rotation Strategy:</strong>{' '}

          {props.pass.rotation.mode === 'noRotation' && 'fallback/default'}
          {props.pass.rotation.mode === 'fullPassPerRotation' && 'Do the entire path, then rotate. Repeat.'}
          {props.pass.rotation.mode === 'onePassPerRotation' && 'Each pass (cut-retract group) is done once per rotation step.'}
          {props.pass.rotation.mode === 'repeatPassOverRotation' && 'Each pass is repeated at every rotary step before moving to next.'}

          <br />
          <strong>Steps:</strong> {props.pass.rotation.steps}
          <br />
          <strong>Angle Range:</strong> {props.pass.rotation.startAngle}° to {props.pass.rotation.endAngle}°
          {props.pass.rotation.angleAfterCompleted !== undefined && (
            <>
              <br />
              <strong>Angle After Completion:</strong> {props.pass.rotation.angleAfterCompleted}°
            </>
          )}
        </div>
      )}

      {/* Your input sections (start and end points) go here */}
    </> 
    </div>
  </details> 
}