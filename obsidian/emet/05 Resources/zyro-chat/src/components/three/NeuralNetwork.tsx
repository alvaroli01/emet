import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Hero visual: a glassy core ("Zyro") orbited by a network of nodes —
 * five larger glowing "AI employee" nodes wired into a mesh of smaller
 * task nodes, with data pulses travelling along the connections.
 *
 * Performance budget: ~8 draw calls total (instancing + merged buffers),
 * DPR capped at 1.75, render loop paused while off-screen.
 */

// Mirrors the CSS tokens in src/index.css
const C = {
  brand500: '#3346FF',
  brand400: '#6A7CFF',
  brand300: '#9EADFF',
  brand700: '#1D26C4',
  ion500: '#18C5F2',
  ion300: '#7DDEFA',
}
const EMPLOYEE_COLORS = [C.brand500, C.ion500, C.brand400, C.ion300, C.brand700]

const RADIUS = 1.65
const NODE_COUNT = 64
const PULSE_COUNT = 28

type Graph = {
  nodes: THREE.Vector3[]
  employees: number[]
  edges: [number, number][]
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function buildGraph(): Graph {
  const rand = seeded(42)
  const nodes: THREE.Vector3[] = []
  // Fibonacci sphere with radial jitter → even but organic distribution
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    const jitter = RADIUS * (0.82 + rand() * 0.3)
    nodes.push(new THREE.Vector3(Math.cos(theta) * r * jitter, y * jitter, Math.sin(theta) * r * jitter))
  }
  // Five well-separated employee nodes
  const employees = [5, 18, 31, 44, 57]

  // k-nearest-neighbour edges, de-duplicated
  const key = new Set<string>()
  const edges: [number, number][] = []
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => ({ j, d: a.distanceToSquared(b) }))
      .filter((n) => n.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, employees.includes(i) ? 6 : 3)
    nearest.forEach(({ j }) => {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`
      if (!key.has(k)) {
        key.add(k)
        edges.push([i, j])
      }
    })
  })
  return { nodes, employees, edges }
}

function makeGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function Network({ pointer }: { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null!)
  const shell = useRef<THREE.Mesh>(null!)
  const employeeMesh = useRef<THREE.InstancedMesh>(null!)
  const nodeMesh = useRef<THREE.InstancedMesh>(null!)
  const pulseGeo = useRef<THREE.BufferGeometry>(null!)

  const graph = useMemo(buildGraph, [])
  const glowTex = useMemo(makeGlowTexture, [])

  // Merged line buffer (1 draw call) with a subtle brand→ion vertex gradient
  const lineGeo = useMemo(() => {
    const pos: number[] = []
    const col: number[] = []
    const a = new THREE.Color(C.brand400)
    const b = new THREE.Color(C.ion500)
    graph.edges.forEach(([i, j]) => {
      const p = graph.nodes[i]
      const q = graph.nodes[j]
      pos.push(p.x, p.y, p.z, q.x, q.y, q.z)
      col.push(a.r, a.g, a.b, b.r, b.g, b.b)
    })
    // spokes from the core to each employee
    graph.employees.forEach((e) => {
      const p = graph.nodes[e]
      pos.push(0, 0, 0, p.x, p.y, p.z)
      col.push(a.r, a.g, a.b, b.r, b.g, b.b)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    return g
  }, [graph])

  // Soft halos behind nodes (sprite points; 2 draw calls — employees get larger halos)
  const [employeeHalo, nodeHalo] = useMemo(() => {
    const make = (indices: number[], colorFor: (i: number) => string) => {
      const pos: number[] = []
      const col: number[] = []
      indices.forEach((i) => {
        const p = graph.nodes[i]
        const c = new THREE.Color(colorFor(i))
        pos.push(p.x, p.y, p.z)
        col.push(c.r, c.g, c.b)
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      return g
    }
    const others = graph.nodes.map((_, i) => i).filter((i) => !graph.employees.includes(i))
    return [
      make(graph.employees, (i) => EMPLOYEE_COLORS[graph.employees.indexOf(i)]),
      make(others, () => C.brand300),
    ]
  }, [graph])

  // Travelling data pulses
  const pulses = useMemo(() => {
    const rand = seeded(7)
    return Array.from({ length: PULSE_COUNT }, () => ({
      edge: Math.floor(rand() * graph.edges.length),
      t: rand(),
      speed: 0.25 + rand() * 0.45,
    }))
  }, [graph])
  const pulsePositions = useMemo(() => new Float32Array(PULSE_COUNT * 3), [])

  // Place instanced nodes once
  useEffect(() => {
    const m = new THREE.Matrix4()
    let n = 0
    graph.nodes.forEach((p, i) => {
      if (graph.employees.includes(i)) return
      m.makeTranslation(p.x, p.y, p.z)
      nodeMesh.current.setMatrixAt(n++, m)
    })
    nodeMesh.current.instanceMatrix.needsUpdate = true
    graph.employees.forEach((_e, k) => {
      employeeMesh.current.setColorAt(k, new THREE.Color(EMPLOYEE_COLORS[k]))
    })
    if (employeeMesh.current.instanceColor) employeeMesh.current.instanceColor.needsUpdate = true
  }, [graph])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3() }), [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.05)

    // Idle spin + eased mouse parallax
    const g = group.current
    g.rotation.y += dt * 0.08
    const targetX = pointer.current.y * 0.25
    const targetZ = -pointer.current.x * 0.12
    g.rotation.x += (targetX - g.rotation.x) * 0.04
    g.rotation.z += (targetZ - g.rotation.z) * 0.04
    g.position.x += (pointer.current.x * 0.15 - g.position.x) * 0.04
    g.position.y += (pointer.current.y * 0.1 - g.position.y) * 0.04 + Math.sin(t * 0.8) * 0.0008

    shell.current.rotation.y -= dt * 0.12
    shell.current.rotation.x += dt * 0.05

    // Employees gently "breathe"
    graph.employees.forEach((e, k) => {
      const p = graph.nodes[e]
      const s = 1 + Math.sin(t * 1.6 + k * 1.3) * 0.12
      tmp.s.set(s, s, s)
      tmp.m.compose(p, tmp.q, tmp.s)
      employeeMesh.current.setMatrixAt(k, tmp.m)
    })
    employeeMesh.current.instanceMatrix.needsUpdate = true

    // Advance pulses along their edges
    pulses.forEach((pl, i) => {
      pl.t += dt * pl.speed
      if (pl.t > 1) {
        pl.t = 0
        pl.edge = (pl.edge * 7 + 13) % graph.edges.length
      }
      const [a, b] = graph.edges[pl.edge]
      tmp.v.lerpVectors(graph.nodes[a], graph.nodes[b], pl.t)
      pulsePositions[i * 3] = tmp.v.x
      pulsePositions[i * 3 + 1] = tmp.v.y
      pulsePositions[i * 3 + 2] = tmp.v.z
    })
    const attr = pulseGeo.current.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
  })

  return (
    <group ref={group}>
      {/* Glassy core */}
      <mesh>
        <icosahedronGeometry args={[0.62, 12]} />
        <meshPhysicalMaterial
          color={C.brand400}
          emissive={C.brand500}
          emissiveIntensity={0.25}
          metalness={0.3}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={0.9}
          iridescenceIOR={1.3}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* Wireframe shell */}
      <mesh ref={shell}>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshBasicMaterial color={C.brand400} wireframe transparent opacity={0.35} />
      </mesh>

      {/* Connections */}
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial vertexColors transparent opacity={0.32} depthWrite={false} />
      </lineSegments>

      {/* Task nodes */}
      <instancedMesh ref={nodeMesh} args={[undefined, undefined, NODE_COUNT - graph.employees.length]}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshStandardMaterial color={C.brand400} roughness={0.3} metalness={0.2} />
      </instancedMesh>

      {/* Employee nodes */}
      <instancedMesh ref={employeeMesh} args={[undefined, undefined, graph.employees.length]}>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshPhysicalMaterial roughness={0.15} metalness={0.2} clearcoat={1} envMapIntensity={1.2} />
      </instancedMesh>

      {/* Halos */}
      <points geometry={employeeHalo}>
        <pointsMaterial vertexColors map={glowTex} size={0.95} sizeAttenuation transparent opacity={0.6} depthWrite={false} />
      </points>
      <points geometry={nodeHalo}>
        <pointsMaterial vertexColors map={glowTex} size={0.22} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
      </points>

      {/* Data pulses */}
      <points>
        <bufferGeometry ref={pulseGeo}>
          <bufferAttribute attach="attributes-position" args={[pulsePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={C.ion500} map={glowTex} size={0.16} sizeAttenuation transparent depthWrite={false} />
      </points>
    </group>
  )
}

export default function NeuralNetwork() {
  const wrap = useRef<HTMLDivElement>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const [visible, setVisible] = useState(true)

  // Pointer parallax tracked at window level so it reacts anywhere in the hero
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Stop rendering when scrolled out of view (saves battery + main thread)
  useEffect(() => {
    if (!wrap.current) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 })
    io.observe(wrap.current)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden>
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 5.4], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <Network pointer={pointer} />
        {/* Local studio lighting — no external HDR download */}
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={3} position={[0, 3, 3]} scale={[6, 2, 1]} color="#ffffff" />
          <Lightformer intensity={2} position={[-4, 0, 1]} scale={[2, 6, 1]} color={C.ion300} />
          <Lightformer intensity={2} position={[4, -1, 1]} scale={[2, 6, 1]} color={C.brand300} />
        </Environment>
      </Canvas>
    </div>
  )
}
