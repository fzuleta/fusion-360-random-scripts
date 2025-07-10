import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useEffect, useRef } from 'react'
import styles from './app.module.scss'
import { getLines } from './toolpath'
import { STLLoader } from 'three-stdlib';

let scene: THREE.Scene;

function App() {
  const mountRef = useRef<HTMLDivElement>(null)

  const createLine = (p: PointXY, radius: number) => {
    const ringGeom = new THREE.RingGeometry(radius - 0.01, radius, 512);
    const ringMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 });
    const ring = new THREE.Line(ringGeom, ringMat);
    ring.position.set(p.x, p.y, 0.02); // offset slightly in Z to avoid z-fighting
    scene.add(ring);
  }
  const draw = () => {
    const stockRadius = 3;
    const bitRadius = 3.175 / 2;
    const stepOver = 0.5 // 0.025
    const lines = getLines({bitRadius, stockRadius, stepOver});
    if (!scene) return;


    // Render morphedLines with progressively lighter color
    lines.morphedLines.forEach((line, index) => {
      const t = index / lines.morphedLines.length
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0xd72c12),
        new THREE.Color(0xffff00),
        t
      )
      const material = new THREE.LineBasicMaterial({ color })
      const points = line.map(p => new THREE.Vector3(p.x, p.y, 0.01))
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const lineMesh = new THREE.Line(geometry, material)
      scene.add(lineMesh);
      // Draw a translucent circle at each point

      line.forEach((p) => {
        createLine(p, 0.05)
        // if (index > 0 && index < line.length - 1) { return }
        createLine(p, bitRadius)
      }); 
    })

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    lines.originalLines.forEach((line) => {
      const points = line.map(p => new THREE.Vector3(p.x, p.y, 0.03));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMesh = new THREE.Line(geometry, material);
      scene.add(lineMesh); 
    });
 
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

    scene.add(mesh);
  });
  }
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

    loadMesh()
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
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
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
    draw()
    return () => {
      mount.removeChild(renderer.domElement)
    }
  }, [])
return (
  <div className={styles.container}>
    <div className={styles.header}>
      <button onClick={() => draw()}>Generate Toolpath</button>
    </div>
    <div ref={mountRef} className={styles.canvas} />
  </div>
)
}

export default App

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