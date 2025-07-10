import * as THREE from 'three'
import * as React from 'react'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useEffect, useRef } from 'react'
import styles from './app.module.scss'
import { getLines, type ILinesGotten } from './toolpath'
import { STLLoader } from 'three-stdlib';

let scene: THREE.Scene; 
const hexs = [0x5ba5dd, 0x5ba5dd, 0xe69d9d]
function App() {
  const [bitRadius, setBitRadius] = React.useState(3.175 / 2)
  const [stepOver, setStepOver] = React.useState(0.5) // 0.04
  const [stockRadius, setStockRadius] = React.useState(6 / 2)
  const [lines, setLines] = React.useState<ILinesGotten>()
  const mountRef = useRef<HTMLDivElement>(null)
  const toolpathGroupRef = useRef<THREE.Group | null>(null);

  const createLine = (p: THREE.Vector3, radius: number, color=0xffffff) => {
    const ringGeom = new THREE.RingGeometry(radius - 0.01, radius, 512);
    const ringMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.05 });
    const ring = new THREE.Line(ringGeom, ringMat);
    ring.position.set(p.x, p.y, 0.02); // offset slightly in Z to avoid z-fighting
    toolpathGroupRef.current!.add(ring);
  }
  const draw = () => {
    if (!lines) { return; }
    if (!scene) return; 
    if (toolpathGroupRef.current) {
      scene.remove(toolpathGroupRef.current);
    }
    toolpathGroupRef.current = new THREE.Group();

    loadMesh()
    const morphedLines = convertToVector3(lines.morphedLines);

    // Render morphedLines with progressively lighter color
    morphedLines.forEach((points, index) => {
      const t = index / morphedLines.length
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0xd72c12),
        new THREE.Color(0xffff00),
        t
      )
      const material = new THREE.LineBasicMaterial({ color }) 
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const lineMesh = new THREE.Line(geometry, material)
      toolpathGroupRef.current!.add(lineMesh);
      // Draw a translucent circle at each point

      points.forEach((p) => {
        createLine(p, 0.05)
        if (index <= 1 || index === points.length - 1) { 
          createLine(p, bitRadius, hexs[index] || hexs[hexs.length-1])
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

    scene.add(toolpathGroupRef.current);
  }
  const loadMesh = () => {
    // after you create scene, camera, renderer, etc.
    const loader = new STLLoader();
      loader.load('m=0.13 Z=112.stl', geometry => {
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

      // ── 3️⃣  Optionally: adjust camera/frustum later to fit the bbox ──────
      // (camera logic stays where it is; it will already see the object).

      toolpathGroupRef.current!.add(mesh);
    });
  }
  const clearToolPathFromView = () => {
    if (!toolpathGroupRef.current) { return; }
    scene.remove(toolpathGroupRef.current);
    toolpathGroupRef.current = null;
  }
  React.useEffect(() => {
    if (!scene) return;
    if (!lines) {
      clearToolPathFromView()
      return;
    }
    draw();
  }, [lines]);
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x444444) // dark gray
    // ── Lights ────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.6); // soft white
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.4);
    dir.position.set(1, 1, 1);   // from above‑right‑front
    scene.add(dir);

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
    )
    camera.position.set(0, 0, 500)
    camera.lookAt(0, 0, 0)

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
    controls.update();

    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 100, 0x333333, 0x333333)
    gridHelper.rotation.x = Math.PI / 2 // rotate from XZ to XY

    scene.add(gridHelper)

    // Add coordinate axes helper
    const axesHelper = new THREE.AxesHelper(1)
    axesHelper.translateZ(0.01)
    scene.add(axesHelper)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()


    setLines(getLines({bitRadius, stockRadius, stepOver})); 
    return () => {
      mount.removeChild(renderer.domElement)
    }
  }, [])
return (
  <div className={styles.container}>
    <div className={styles.header}>
      <label>
        Bit Radius:
        <input
          type="number"
          value={bitRadius}
          step="0.01"
          min="0"
          onChange={(e) => setBitRadius(parseFloat(e.target.value))}
        />
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
      <label>
        Stock Radius:
        <input
          type="number"
          value={stockRadius}
          step="0.01"
          min="0"
          onChange={(e) => setStockRadius(parseFloat(e.target.value))}
        />
      </label>
      <button onClick={() => clearToolPathFromView()}>Clear stage</button>
      <button onClick={() => draw()}>Generate Toolpath</button>
    </div>
    <div ref={mountRef} className={styles.canvas} />
  </div>
)
}

export default App

const convertToVector3 = (lines: PointXY[][]) => {
  return lines.map(line => line.map(pt => new THREE.Vector3(pt.x, pt.y, 0.01)))
}
function closestPointOnSegment(p: PointXY, a: PointXY, b: PointXY): PointXY {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)))
  return {
    x: a.x + abx * t,
    y: a.y + aby * t,
  }
}