import * as THREE from 'three'
import * as React from 'react'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import styles from './app.module.scss'
import { STLLoader } from 'three-stdlib';
import { models, type IConstructed, type IConstruction } from './data'; 
import { degToRad, isNumeric, range } from './helpers';
import {
  generateGCodeFromSegments, 
} from './toolpath/morph-lines';
import { Overlay } from './components/overlay';
import { generatePath } from './data/helpers';

type Material = 'brass' | 'A2' | '316L';

function App() {
  const [otherThingsToRender, setOtherThingsToRender] = React.useState<{[k: string]: () => unknown}>({});
  const [passNum, setPassNum] = React.useState(0);
  // Feed‑rate in mm/min (20 = very slow, 200 = nominal)
  const [feedRate, setFeedRate] = React.useState(2000);
  const [stepOver, setStepOver] = React.useState(0.2); 
  const [material, setMaterial] = React.useState<Material>('A2');
  const [stockRadius, setStockRadius] = React.useState(6 * 0.5); // ((3/8) * 25.4) / 2); // 6 / 2);
  const [modelBit, setModelBit] = React.useState(models[Object.keys(models)[0]]);
  const [pass, setPass] = React.useState<IConstruction | undefined>(undefined);
  const [constructed, setConstructed] = React.useState<IConstructed | undefined>(undefined);
  const [passes, setPasses] = React.useState<IConstruction[]>([]);
  // const [lines, setLines] = React.useState<ILinesGotten>();
  const feedRateRef = React.useRef(120);
  const bitMeshRef = React.useRef<THREE.Mesh>(null);
  const mountRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<THREE.Scene | undefined>(undefined);
  const toolpathGroupRef = React.useRef<THREE.Group | null>(null); 
  const orbitControlsRef = React.useRef<OrbitControls | undefined>(undefined);
  const [_renderer, setRenderer] = React.useState<THREE.WebGLRenderer>();

  const [scrub, setScrub] = React.useState(0);            // 0‑100 %
  const isScrubbingRef = React.useRef(false);
  const pathRef = React.useRef<TVector3[]>([]);
  // Shared progress for animBit <–> scrub slider
  const wheelStateRef = React.useRef<{ i: number; t: number }>({ i: 0, t: 0 });
  // Animation pause state
  const isAnimationPausedRef = React.useRef(false);

  const draw = () => {
    if (!sceneRef.current) return; 
    if (toolpathGroupRef.current) {
      sceneRef.current.remove(toolpathGroupRef.current);
    }
    toolpathGroupRef.current = new THREE.Group();
    sceneRef.current.add(toolpathGroupRef.current);
 
    if (!pass) { return; }

    loadMesh();
    loadStock();
    const animBit = (path: TVector3[]) => {
      // reset & alias shared state for this new path
      wheelStateRef.current.i = 0;
      wheelStateRef.current.t = 0;
      const wheelState = wheelStateRef.current;
      const clock = new THREE.Clock();

      const other = otherThingsToRender;
      other['tooth'] = () => {
        if (isScrubbingRef.current || isAnimationPausedRef.current) return;   // freeze while slider is held or animation is paused
        // elapsed time
        const dt = Math.min(clock.getDelta(), 0.1); // cap to 100ms

        // ── Skip any zero‑length segments (duplicate points) ────────────
        const n = path.length;
        // while (
        //   wheelState.i < n - 1 &&
        //   path[wheelState.i].equals(path[(wheelState.i + 1) % n])
        // ) {
          // wheelState.i++;
        // }

        const p0 = path[wheelState.i];
        const p1 = path[(wheelState.i + 1) % n];
        const segLen = p0.distanceTo(p1);

        // If after skipping dupes we still have a zero‑length segment,
        // just bail for this frame.
        if (segLen === 0) return;

        const feed = p0.isCut ? (feedRateRef.current / 60) : 10; // convert mm/min → mm/sec
        const dFrac = (feed * dt) / segLen;
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
    if (!constructed) { return console.error('no constructed'); }
    if (constructed.segmentsForThreeJs && constructed.segmentsForThreeJs.length) {
      const path: TVector3[] = constructed.segmentsForThreeJs;
      pathRef.current = path;

      // build geometry
      const geo = new THREE.BufferGeometry().setFromPoints(path);

      // ── create a red → yellow gradient ──────────────────────────────
      const cStart = new THREE.Color(0xff0000);   // red
      const cEnd   = new THREE.Color(0xffff00);   // yellow
      const colours: number[] = [];

      const last = path.length - 1;
      path.forEach((p: TVector3, i) => {
        if (p.isArc) {
          colours.push(0, 1, 0);          // green arcs
        } else if (p.isRapid) {
          colours.push(0, 1, 1);          // cyan rapids
        } else if (p.isRetract) {
          colours.push(1, 0, 1);          // magenta retracts
        } else {
          const t = last === 0 ? 0 : i / last;
          const col = cStart.clone().lerp(cEnd, t);
          colours.push(col.r, col.g, col.b);
        }
      });

      geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
      const mat  = new THREE.LineBasicMaterial({ vertexColors: true });
      const line = new THREE.Line(geo, mat);
      toolpathGroupRef.current.add(line);

      drawRotaryVisual(constructed.originalLines, pass.rotation);

      animBit(path);
      return;
    }
  }
  function loadStock() {
    if (!toolpathGroupRef.current) return;

    const height = 60; // set this to your actual stock length
    const segments = 64;
    const pointsTop: THREE.Vector3[] = [];
    const pointsBottom: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const z = Math.cos(theta) * stockRadius;
      const y = Math.sin(theta) * stockRadius;
      pointsTop.push(new THREE.Vector3(0, y, z));
      pointsBottom.push(new THREE.Vector3(-height, y, z)); // extend in -X
    }
    const mat = new THREE.LineBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.2,
    });
    const geoTop = new THREE.BufferGeometry().setFromPoints(pointsTop);
    const geoBottom = new THREE.BufferGeometry().setFromPoints(pointsBottom);
    const lineTop = new THREE.LineLoop(geoTop, mat);
    const lineBottom = new THREE.LineLoop(geoBottom, mat);

    const topToBottomLines = pointsTop.map((pt, _) => {
      return new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, pt.y, pt.z),
          new THREE.Vector3(-height, pt.y, pt.z)
        ]),
        mat
      );
    });

    toolpathGroupRef.current.add(lineTop);
    toolpathGroupRef.current.add(lineBottom);
    topToBottomLines.forEach(l => toolpathGroupRef.current!.add(l));
  }
  const drawRotaryVisual = (originalLines: PointXYZ[][], rotation?: NonNullable<IConstruction["rotation"]>) => {
    if (!rotation) { return; }
    const segments: TVector3[] = [];

    // Build rotarySegments from the first two original lines
    // const lines0 = originalLines?.[0] ?? [];
    const lines1 = originalLines?.[1] ?? [];

    // for (let i = 0; i < lines0.length - 1; i++) {
    //   const a = lines0[i];
    //   const b = lines0[i + 1];
    //   segments.push(new THREE.Vector3(a.x, a.y, a.z ?? 0));
    //   segments.push(new THREE.Vector3(b.x, b.y, b.z ?? 0));
    // }
    for (let i = 0; i < lines1.length - 1; i++) {
      const a = lines1[i];
      const b = lines1[i + 1];
      segments.push(new THREE.Vector3(a.x, a.y, a.z ?? 0));
      segments.push(new THREE.Vector3(b.x, b.y, b.z ?? 0));
    }

    switch (rotation.mode) {
      case 'fullPassPerRotation':
        return drawFullPassPerRotation(segments, rotation);
      case 'onePassPerRotation':
        return drawOnePassPerRotation(segments, rotation);
      case 'repeatPassOverRotation':
        return drawRepeatPassOverRotation(segments, rotation);
      default:
        console.warn("Unknown rotation mode:", rotation.mode);
    }
  };
  const drawFullPassPerRotation = (segments: TVector3[], rotation: IConstruction["rotation"]) => {
    if (!rotation) { return; }
    const angleStep = (rotation.endAngle - rotation.startAngle) / rotation.steps;
    for (let i = 0; i < rotation.steps; i++) {
      const angle = degToRad(rotation.startAngle + i * angleStep);
      const pts = segments.map(p => p.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), angle));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.5 });
      toolpathGroupRef.current?.add(new THREE.Line(geo, mat));
    }
  };

  const drawOnePassPerRotation = (segments: TVector3[], rotation: IConstruction["rotation"]) => {
    if (!rotation) { return; }
    const angleStep = (rotation.endAngle - rotation.startAngle) / rotation.steps;
    const passes: TVector3[][] = [];
    let buf: TVector3[] = [];
    segments.forEach(p => {
      buf.push(p);
      if (p.isRetract) {
        passes.push(buf);
        buf = [];
      }
    });
    if (buf.length) passes.push(buf);
    for (let i = 0; i < passes.length; i++) {
      const angle = degToRad(rotation.startAngle + i * angleStep);
      const pts = passes[i].map(p => p.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), angle));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x33ccff, transparent: true, opacity: 0.7 });
      toolpathGroupRef.current?.add(new THREE.Line(geo, mat));
    }
  };

  const drawRepeatPassOverRotation = (segments: TVector3[], rotation: IConstruction["rotation"]) => {
    if (!rotation) { return; }
    const angleStep = (rotation.endAngle - rotation.startAngle) / rotation.steps;
    const passes: TVector3[][] = [];
    let buf: TVector3[] = [];
    segments.forEach(p => {
      buf.push(p);
      if (p.isRetract) {
        passes.push(buf);
        buf = [];
      }
    });
    if (buf.length) passes.push(buf);
    passes.forEach(pass => {
      for (let i = 0; i < rotation.steps; i++) {
        const angle = degToRad(rotation.startAngle + i * angleStep);
        const pts = pass.map(p => p.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), angle));
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.3 });
        toolpathGroupRef.current?.add(new THREE.Line(geo, mat));
      }
    });
  };
  const loadMesh = () => {
    if (!pass) { return; }
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
      // Shift so the **far‑left (min X) mid‑height, mid‑depth** becomes origin
      const centre = new THREE.Vector3(
        box.min.x,                               // far left in X
        (box.min.y + box.max.y) / 2,             // middle of Y
        (box.min.z + box.max.z) / 2              // middle of Z
      );
      mesh.rotateZ(degToRad(180));                     // rotate 180 degrees around Z
      mesh.position.set(centre.x, centre.y, centre.z);                // translate so that point → (0,0,0)
      // mesh.position.set(-0.165, 6 + 2.455, 0);                // move to origin
      toolpathGroupRef.current!.add(mesh); 
    });

    // ── Wheel modelled as a thin CYLINDER ──────────────── 
    const bitMesh = constructed!.bitMesh;
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
    feedRateRef.current = feedRate;
  }, [feedRate]);

  React.useEffect(() => {
    setPassNum(0);
    setMaterial('A2');
  }, [modelBit]);





  React.useEffect(() => {
    if (!modelBit) { return; }
    const pass = modelBit.getPass(passNum)();
    setPass(pass);
    setStepOver(pass.defaultBit.material[material]!.stepOver);
    setFeedRate(pass.defaultBit.material[material]!.feedRate);
    const constructed = pass.construct({ /** bit, */ material, stockRadius })
    setConstructed(() => {
      return constructed;
    });
  }, [passNum, material, stockRadius]); 
  React.useEffect(() => {
    if (!sceneRef.current || !pass || !constructed) return;
    const bit: IBit = JSON.parse(JSON.stringify(constructed.bit));
    bit.material[material]!.feedRate = feedRate;
    bit.material[material]!.stepOver = stepOver;
    const newConstructed = pass.construct({ bit, material, stockRadius })
    setConstructed(newConstructed);
  }, [feedRate, stepOver, stockRadius]);  
  React.useEffect(() => {
    console.log("Changing constructed to: ", constructed)
    if (!sceneRef.current || !pass || !constructed) return;
    draw();
  }, [constructed]);
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
    setRenderer(renderer);
    
    const controls = new OrbitControls(camera, renderer.domElement)
    orbitControlsRef.current = controls;
    controls.enableDamping = false
    controls.dampingFactor = 0.05
    controls.screenSpacePanning = false
    controls.enablePan = true
    controls.zoomToCursor = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
    controls.target.x = -5;   // slide view ~20 mm left
    controls.update();

    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 100, 0x000000, 0x3f3f3f)
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
    if (!bitMeshRef.current || pathRef.current.length < 2 || !wheelStateRef) return;

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


  /** Download the current pass as G‑code (.nc) */
  const handleDownloadGcode = () => { 
    if (!pass || !constructed) return;

    const gcodeLines = generateGCodeFromSegments({
      material,
      segments: constructed.segmentsForGcodeFitted,
      bit: constructed.bit,
      rotation: pass.rotation,
    });

    const blob = new Blob([gcodeLines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `pass-${passNum}.nc`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          Material:
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value as Material)}
          >
            {/* <option value="brass">brass</option> */}
            <option value="A2">A2</option>
            {/* <option value="316L">316L</option> */}
            {/* <option value="316L">carbide</option> */}
          </select>
        </label>

        <label>
          Pass:
          <select
            value={passNum}
            onChange={(e) => setPassNum(parseInt(e.target.value))}
          >
            {range(modelBit.getHowManyPasses() || 0).map((p, index) => (
              <option key={`passNum-${index}`} value={index}>{modelBit.getPass(p)().name}</option>
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
          Feed&nbsp;Rate&nbsp;(mm/min):
          <input
            type="number"
            value={feedRate}
            step="10"
            min="10"
            max="500"
            style={{ width: 60 }}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNumeric(v)) return;
              setFeedRate(v);
            }}
          />
        </label> 
        <label>
          Stock radius (mm):
          <input
            type="number"
            value={stockRadius.toFixed(3)}
            step="0.1"
            min="0.5"
            max="50"
            style={{ width: 60 }}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNumeric(v)) return;
              setStockRadius(v);
            }}
          />
        </label>
        <button style={{ marginLeft: 8 }} onClick={handleDownloadGcode}>
          ⬇︎&nbsp;Download&nbsp;G‑code
        </button>
      </div>
      {/* full‑width scrub slider on its own line */}
      <div style={{ width: '100%', marginTop: 4, display: 'flex' }}>

        <button style={{ marginLeft: 8 }} onClick={() => {
          isAnimationPausedRef.current = !isAnimationPausedRef.current;
        }}>
          {isAnimationPausedRef.current ? '▶︎ Resume' : '❚❚ Pause'}
        </button>
        <label style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          {/* Preview&nbsp;%&nbsp; */}
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
    <Overlay pass={ pass } toolpathGroupRef={toolpathGroupRef} />
    <div ref={mountRef} className={styles.canvas} />
  </div>
)
}

export default App
