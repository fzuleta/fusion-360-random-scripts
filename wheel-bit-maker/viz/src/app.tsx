import * as THREE from 'three'
import * as React from 'react'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import styles from './app.module.scss'
import { STLLoader } from 'three-stdlib';
import { models } from './data';
import * as tooth from './nihs_20_30/wheel';
import { isNumeric } from './helpers';
 

function App() {
  const [otherThingsToRender, setOtherThingsToRender] = React.useState<{[k: string]: () => unknown}>({});
  const [pass, setPass] = React.useState(0);
  const [animSpeed, setAnimSpeed] = React.useState(1);
  const [stepOver, setStepOver] = React.useState(0.04);
  const [stockRadius] = React.useState(6 / 2);
  const [modelBit, setModelBit] = React.useState(models[Object.keys(models)[0]]);
  // const [lines, setLines] = React.useState<ILinesGotten>();
  const animSpeedRef = React.useRef(1);
  const bitMeshRef = React.useRef<THREE.Mesh>(null);
  const mountRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<THREE.Scene | undefined>(undefined);
  const toolpathGroupRef = React.useRef<THREE.Group | null>(null); 

  const [scrub, setScrub] = React.useState(0);            // 0‑100 %
  const isScrubbingRef = React.useRef(false);
  const pathRef = React.useRef<TVector3[]>([]);
  // Shared progress for animBit <–> scrub slider
  const wheelStateRef = React.useRef<{ i: number; t: number }>({ i: 0, t: 0 });

  const draw = () => {
    if (!sceneRef.current) return; 
    if (toolpathGroupRef.current) {
      sceneRef.current.remove(toolpathGroupRef.current);
    }
    toolpathGroupRef.current = new THREE.Group();
    sceneRef.current.add(toolpathGroupRef.current);

    const p = getPass();
    if (!p) { return; }

    loadMesh();

    const animBit = (path: TVector3[]) => {
      // reset & alias shared state for this new path
      wheelStateRef.current.i = 0;
      wheelStateRef.current.t = 0;
      const wheelState = wheelStateRef.current;
      const clock = new THREE.Clock();

      const other = otherThingsToRender;
      other['tooth'] = () => {
        if (isScrubbingRef.current) return;   // freeze while slider is held
        // elapsed time
        const dt = clock.getDelta();

        // ── Skip any zero‑length segments (duplicate points) ────────────
        const n = path.length;
        while (
          wheelState.i < n - 1 &&
          path[wheelState.i].equals(path[(wheelState.i + 1) % n])
        ) {
          wheelState.i++;
        }

        const p0 = path[wheelState.i];
        const p1 = path[(wheelState.i + 1) % n];
        const segLen = p0.distanceTo(p1);

        // If after skipping dupes we still have a zero‑length segment,
        // just bail for this frame.
        if (segLen === 0) return;

        const speed = p0.isCut ? animSpeedRef.current : 10;
        const dFrac = (speed * dt) / segLen;
        wheelState.t += dFrac;

        // Walk forward through as many nodes as we overshoot
        while (wheelState.t >= 1) {
          wheelState.t -= 1;
          wheelState.i = (wheelState.i + 1) % n;

          // Skip any further zero‑length segments
          while (
            wheelState.i < n - 1 &&
            path[wheelState.i].equals(path[(wheelState.i + 1) % n])
          ) {
            wheelState.i++;
          }
        }

        // Re-fetch endpoints after potential advance
        const a = path[wheelState.i];
        const b = path[(wheelState.i + 1) % n];

        bitMeshRef.current?.position.lerpVectors(a, b, wheelState.t);
        // ── Reflect playback on the slider (if not actively scrubbing) ──
        if (!isScrubbingRef.current && n > 1) {
          const progress = ((wheelState.i + wheelState.t) / (n - 1)) * 100;
          setScrub(progress);
        }
      };
      setOtherThingsToRender(other);
    }
    

    if (pass <= 1 ) {
      const path: TVector3[] = p.path;
      pathRef.current = path;            // ← expose to slider
      // build geometry
      const geo = new THREE.BufferGeometry().setFromPoints(path);

      // ── create a red → yellow gradient ───────────────────────────────
      const cStart = new THREE.Color(0xff0000);   // red
      const cEnd   = new THREE.Color(0xffff00);   // yellow
      const colours: number[] = [];

      const last = path.length - 1;
      path.forEach((p: TVector3, i) => {
        if (!p.isCut) { return colours.push(255,255,255)}
        const t = last === 0 ? 0 : i / last;      // 0 → 1 along the line
        const col = cStart.clone().lerp(cEnd, t); // interpolate
        colours.push(col.r, col.g, col.b);        // push r-g-b
      });

      // attach the colour buffer (3 floats per vertex)
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));

      // material that respects vertex colours
      const mat  = new THREE.LineBasicMaterial({ vertexColors: true });
      const line = new THREE.Line(geo, mat);
      toolpathGroupRef.current.add(line);
      // console.log(JSON.stringify(path)) 
      // const geo  = new THREE.BufferGeometry().setFromPoints(path);
      // const mat  = new THREE.LineBasicMaterial({ color: 0xffffff });
      // const line = new THREE.Line(geo, mat);
      toolpathGroupRef.current.add(line); 
      animBit(path);
      return;
    }
    if (pass === 2) {
      const m = tooth.getMesh(modelBit.points, stepOver, bitMeshRef.current!);
      pathRef.current = m.path;          // ← expose to slider
      toolpathGroupRef.current.add(m.group);
      animBit(m.path);
      return;
    }
  }
  const getPass = () => {
    const p = modelBit.getPasses(stockRadius, stepOver)[pass]; 
    return p;
  }
  const loadMesh = () => {  
    // after you create sceneRef.current, camera, renderer, etc.
    const loader = new STLLoader();
    loader.load(modelBit.filename, geometry => {
      geometry.computeVertexNormals();          // lighting looks nicer
      const material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.0,
        roughness: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      console.log(`STL bounds: ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)} mm`);

      // ── 2️⃣  Centre the mesh on origin but **do not scale** ────────────────
      // Shift so the **far‑right (max X) mid‑height, mid‑depth** becomes origin
      const centre = new THREE.Vector3(
        box.max.x,                               // far right in X
        (box.min.y + box.max.y) / 2,            // middle of Y
        (box.min.z + box.max.z) / 2             // middle of Z
      );
      mesh.position.sub(centre);                // translate so that point → (0,0,0)
      toolpathGroupRef.current!.add(mesh); 
    });

    // ── Wheel modelled as a thin CYLINDER ────────────────
    //   • radius = 0.5mm  (bit.diameter / 2)
    //   • height = 10mm   (bit.height)
    //     Using 32 radial segments for a reasonably smooth circle.
    const bit = getPass().bit;
    // MeshBasicMaterial ignores lights → looks flat.
    // Switch to a PBR‑style material so the cylinder reacts to the Ambient
    // and Directional lights already in the scene.
    const bitMaterial = new THREE.MeshStandardMaterial({
      color: 0x8e98b3,       // same hue
      metalness: 0.7,        // slight metallic sheen
      roughness: 0.3,        // enough gloss to catch highlights
      side: THREE.DoubleSide // keep both faces visible if needed
    });
    const bitGeometru = new THREE.CylinderGeometry(
      bit.diameter / 2,   // radiusTop
      bit.diameter / 2,   // radiusBottom
      bit.height,         // height (along local +Y)
      32                  // radial segments
    );
  
    // Shift the geometry down so its *bottom* face sits at the local origin.
    // (Mesh is later placed with position.y = 0 so the wheel rests on the ground plane.)
    bitGeometru.translate(0, -bit.height / 2, 0);  
    bitGeometru.rotateX(-Math.PI / 2); // Rotate so the rectangle lies in the X‑Z plane (normal +Y)
    const bitMesh = new THREE.Mesh(bitGeometru, bitMaterial);
    bitMeshRef.current = bitMesh;
    bitMesh.position.set(10, 10, 0)
    toolpathGroupRef.current!.add(bitMesh);
  }
  const clearToolPathFromView = () => {
    if (!sceneRef.current) { return; }
    if (!toolpathGroupRef.current) { return; }
    sceneRef.current.remove(toolpathGroupRef.current);
    bitMeshRef.current = null;
    toolpathGroupRef.current = null;
  } 

  React.useEffect(() => {
    animSpeedRef.current = animSpeed;
  }, [animSpeed]);
  React.useEffect(() => {
    console.log("Changing stepOver to: ", stepOver)
    draw();
  }, [stepOver]);
  React.useEffect(() => {
    const p = getPass();
    console.log("Changing pass to: ", pass, p)
    if (!sceneRef.current) return;
    draw();
  }, [pass]);
  React.useEffect(() => {
    if (!sceneRef.current) return;
    setPass(0);
    draw();
  }, [modelBit]); 
  React.useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    sceneRef.current = new THREE.Scene()
    sceneRef.current.background = new THREE.Color(0x444444) // dark gray
    // ── Lights ────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.6); // soft white
    sceneRef.current.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(1, 1, 1);   // from above‑right‑front
    sceneRef.current.add(dir);

    // Orthographic camera setup
    const aspect = mount.clientWidth / mount.clientHeight
    const frustumSize = 100
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    camera.position.set(30, -30, 100)
    camera.lookAt(0, 0, 0)
    camera.zoom = 5;                 // higher = closer
    camera.updateProjectionMatrix(); // must be called after changing zoom

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = false
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = false
    controls.enablePan = true
    controls.zoomToCursor = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN
    controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY
    controls.target.x = -5;   // slide view ~20 mm left
    controls.update();

    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 100, 0x333333, 0x333333)
    gridHelper.rotation.x = Math.PI / 2 // rotate from XZ to XY

    sceneRef.current.add(gridHelper)

    // Add coordinate axes helper
    const axesHelper = new THREE.AxesHelper(1)
    axesHelper.translateZ(0.01)
    sceneRef.current.add(axesHelper)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      Object.keys(otherThingsToRender).forEach(k => otherThingsToRender[k]())
      renderer.render(sceneRef.current!, camera)
    }
    animate()

    draw();
    return () => {
      mount.removeChild(renderer.domElement)
    }
  }, []);

  React.useEffect(() => {
    if (!bitMeshRef.current || pathRef.current.length < 2) return;

    const path = pathRef.current;
    const u = scrub / 100;                       // 0 → 1
    const last = path.length - 1;
    const idx = Math.floor(u * last);
    const t   = (u * last) - idx;

    const a = path[idx];
    const b = path[Math.min(idx + 1, last)];

    const pos = new THREE.Vector3().lerpVectors(a, b, t);
    bitMeshRef.current.position.copy(pos);
    // sync animBit to the slider
    wheelStateRef.current.i = idx;
    wheelStateRef.current.t = t;
  }, [scrub]);

return (
  <div className={styles.container}>
    <div className={styles.header}>
      <div className={styles.row}>
        <label>
          Model:
          <select
            value={Object.keys(models).find((key) => models[key] === modelBit)}
            onChange={(e) => {
              clearToolPathFromView(); 
              setModelBit(models[e.target.value]);
            }}
          >
            {Object.keys(models).map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </label>

        <label>
          Pass:
          <select
            value={pass}
            onChange={(e) => setPass(parseInt(e.target.value))}
          >
            {modelBit.getPasses(stockRadius, stepOver).map((_, index) => (
              <option key={index} value={index}>Pass {index + 1}</option>
            ))}
          </select>
        </label>

        <label>
          Step Over:
          <input
            type="number"
            value={stepOver}
            step="0.01"
            min="0"
            style={{width: 50}}
            onChange={(e) => {
              let v = parseFloat(e.target.value);
              if (isNumeric(v) && v < 0.01) { v = 0.01; }
              if (isNumeric(v) && v > 1) { v = 1; }
              const a = !isNumeric(v) ? stepOver : v
              setStepOver(a)
            }}
          />
        </label>
        <label>
          Mill Bit Speed:
          <input
            type="number"
            value={animSpeed}
            step="1"
            min="0"
            style={{width: 50}}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              const a = !isNumeric(v) ? animSpeed : v
              setAnimSpeed(a)
            }}
          />
        </label>
      </div>
      {/* full‑width scrub slider on its own line */}
      <div style={{ width: '100%', marginTop: 4 }}>
        <label style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
          Preview&nbsp;%&nbsp;
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={scrub}
            onMouseDown={() => (isScrubbingRef.current = true)}
            onMouseUp={()   => (isScrubbingRef.current = false)}
            onChange={(e) => setScrub(parseFloat(e.target.value))}
            style={{ flexGrow: 1 }}
          />
        </label>
      </div>
      
    </div>
    <div ref={mountRef} className={styles.canvas} />
  </div>
)
}

export default App

const convertToVector3 = (lines: PointXYZ[][]) => {
  return lines.map(line => line.map(pt => new THREE.Vector3(pt.x, pt.y, 0.01)))
}
