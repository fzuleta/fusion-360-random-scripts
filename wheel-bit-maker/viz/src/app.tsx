import * as THREE from 'three'
import * as React from 'react'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import styles from './app.module.scss'
import { getLines, type ILinesGotten } from './toolpath'
import { STLLoader } from 'three-stdlib';
import { models } from './data';
import * as tooth from './nihs_20_30/wheel';
 

function App() {
  const [otherThingsToRender, setOtherThingsToRender] = React.useState<{[k: string]: () => unknown}>({});
  const [pass, setPass] = React.useState(0);
  const [stepOver, setStepOver] = React.useState(0.04);
  const [stockRadius] = React.useState(6 / 2);
  const [modelBit, setModelBit] = React.useState(models[Object.keys(models)[1]]);
  const [lines, setLines] = React.useState<ILinesGotten>();
  const bitMeshRef = React.useRef<THREE.Mesh>(null);
  const mountRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<THREE.Scene | undefined>(undefined);
  const toolpathGroupRef = React.useRef<THREE.Group | null>(null); 

  const createLine = (p: THREE.Vector3, radius: number, color: THREE.Color) => {
    const ringGeom = new THREE.RingGeometry(radius - 0.01, radius, 512);
    const ringMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.1 });
    const ring = new THREE.Line(ringGeom, ringMat);
    ring.position.set(p.x, p.y, 0.02); // offset slightly in Z to avoid z-fighting
    toolpathGroupRef.current!.add(ring);
  }
  const draw = () => {
    if (!sceneRef.current) return; 
    if (toolpathGroupRef.current) {
      sceneRef.current.remove(toolpathGroupRef.current);
    }
    toolpathGroupRef.current = new THREE.Group();
    sceneRef.current.add(toolpathGroupRef.current);

    console.log("bitreading")
    const bit = getPass().bit;
    console.log("bit", bit)
    loadMesh();
    
    // Draw the tooth
    if (pass === 2) {
      const m = tooth.getMesh(modelBit.points, stepOver, bitMeshRef.current!);
      toolpathGroupRef.current.add(m.group);
      const wheelState = { i: 0, t: 0, speed: 1 };
      const clock = new THREE.Clock();

      const other = otherThingsToRender;
      other['tooth'] = () => {
        const dt = clock.getDelta(); 
        const p0 = m.path[wheelState.i];
        const p1 = m.path[(wheelState.i + 1) % m.path.length]; 
        const segLen   = p0.distanceTo(p1);
        const dFrac    = (wheelState.speed * dt) / segLen;
        wheelState.t  += dFrac; 
        if (wheelState.t >= 1) {
          wheelState.t -= 1;
          wheelState.i  = (wheelState.i + 1) % m.path.length;
        } 
        // Re-fetch segment endpoints if we just advanced i
        const a = m.path[wheelState.i];
        const b = m.path[(wheelState.i + 1) % m.path.length];

        bitMeshRef.current?.position.lerpVectors(a, b, wheelState.t);
      };
      setOtherThingsToRender(other);
      return;
    }

    if (!lines) { return; }
    // clear the animation
    const other = otherThingsToRender;
    delete other['tooth'];
    setOtherThingsToRender(other);

  

    // draw morphed lines
    const morphedLines = convertToVector3(lines.morphedLines);

    // Render morphedLines with progressively lighter color
    morphedLines.forEach((points, index) => {
      const t = index / (morphedLines.length-1)
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0xffff00),
        new THREE.Color(0xff7200),
        t
      )
      const material = new THREE.LineBasicMaterial({ color }) 
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const lineMesh = new THREE.Line(geometry, material)
      toolpathGroupRef.current!.add(lineMesh);
      // Draw a translucent circle at each point

      points.forEach((p) => {
        if (index <= 1 || index === morphedLines.length - 1) { 
          createLine(p, 0.05, new THREE.Color(0xffffff)); 
          createLine(p, bit.diameter * 0.5, color)
        }
      }); 
    })

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    lines.originalLines.forEach((line) => {
      const points = line.map(p => new THREE.Vector3(p.x, p.y, 0.03));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMesh = new THREE.Line(geometry, material);
      toolpathGroupRef.current!.add(lineMesh); 
    });

  }
  const getPass = () => { 
    const p = modelBit.getPasses(stockRadius)[pass]; 
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
  const loadLines = () => {
    const p = modelBit.getPasses(stockRadius)?.[pass];
    console.log(`Changing lines `, p)
    if (!p.lineA) { return setLines(undefined); }
    setLines(getLines({stepOver, ...p})); 
  }
  const clearToolPathFromView = () => {
    if (!sceneRef.current) { return; }
    if (!toolpathGroupRef.current) { return; }
    sceneRef.current.remove(toolpathGroupRef.current);
    bitMeshRef.current = null;
    toolpathGroupRef.current = null;
  } 
  React.useEffect(() => {
    if (!sceneRef.current) return;
    draw();
  }, [lines]);
  React.useEffect(() => { 
    loadLines();
  }, [stepOver]);
  React.useEffect(() => {
    const p = getPass();
    console.log("Changing pass to: ", pass, p)
    if (!sceneRef.current) return;  
    loadLines();
  }, [pass]);
  React.useEffect(() => {
    if (!sceneRef.current) return;
    setPass(0); 
    loadLines();
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


    loadLines();
    return () => {
      mount.removeChild(renderer.domElement)
    }
  }, []);
return (
  <div className={styles.container}>
    <div className={styles.header}>
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
          {modelBit.getPasses(stockRadius).map((_, index) => (
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
          onChange={(e) => setStepOver(parseFloat(e.target.value))}
        />
      </label>
      {/* <label>
        Stock Radius:
        <input
          type="number"
          value={stockRadius}
          step="0.01"
          min="0"
          onChange={(e) => setStockRadius(parseFloat(e.target.value))}
        />
      </label> */}
      {/* <button onClick={() => clearToolPathFromView()}>Clear stage</button> */}
      {/* <button onClick={() => {
        clearToolPathFromView(); 
        requestAnimationFrame(() => loadLines())
      }}>Generate Toolpath</button> */}
    </div>
    <div ref={mountRef} className={styles.canvas} />
  </div>
)
}

export default App

const convertToVector3 = (lines: PointXYZ[][]) => {
  return lines.map(line => line.map(pt => new THREE.Vector3(pt.x, pt.y, 0.01)))
}
