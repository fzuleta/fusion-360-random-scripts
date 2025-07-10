import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { useEffect, useRef } from 'react'
import styles from './app.module.scss'
import { getLines } from './toolpath'

let scene: THREE.Scene;

function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const draw = () => {
    const bitRadius = 3.175 / 2;
    const stepOver = 1//0.05
    const lines = getLines({bitRadius, stepOver});
    if (!scene) return;


    // Render morphedLines with progressively lighter color
    lines.morphedLines.forEach((line, index) => {
      const t = index / lines.morphedLines.length
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0xd72c12), // start: black
        new THREE.Color(0xffff00), // end: yellow
        t
      )
      const material = new THREE.LineBasicMaterial({ color })
      const points = line.map(p => new THREE.Vector3(p.x, p.y, 0))
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const lineMesh = new THREE.Line(geometry, material)
      scene.add(lineMesh);
      if (index === 0 || index === lines.morphedLines.length -1 ) { 
        // Draw a translucent circle at each point
        line.forEach((p) => {
          const circleGeom = new THREE.CircleGeometry(bitRadius, 32);
          const circleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
          const circle = new THREE.Mesh(circleGeom, circleMat);
          circle.position.set(p.x, p.y, 0.01); // offset slightly in Z to avoid z-fighting
          scene.add(circle);
        });
      }
    })

    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    lines.originalLines.forEach((line) => {
      const points = line.map(p => new THREE.Vector3(p.x, p.y, 0));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const lineMesh = new THREE.Line(geometry, material);
      scene.add(lineMesh); 
    });
  }
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x595959) // dark gray
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
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN

    // Add grid helper
    const gridHelper = new THREE.GridHelper(100, 100, 0x333333, 0x333333)
    gridHelper.rotation.x = Math.PI / 2 // rotate from XZ to XY
    scene.add(gridHelper)

    // Add coordinate axes helper
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

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
