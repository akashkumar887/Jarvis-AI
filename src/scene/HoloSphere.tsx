import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Drive } from './Scene'

/**
 * Tony Stark's J.A.R.V.I.S. Holographic Sphere Core
 * Modelled after the iconic Avengers / Iron Man holographic golden neural matrix.
 *
 * Features:
 * - 3D Gyroscopic Gimbal Rings (multi-axis precession rotation)
 * - Concentric Latitude & Longitude Coordinate Arcs
 * - Radial Instrument Tick Marks & Segmented HUD Dials
 * - Volumetric Glowing Energy Nucleus
 * - Audio-reactive expansion & luminous pulse
 */

// Helper to create circle line geometry
function createCircleGeometry(radius: number, segments = 64) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

// Helper to create segmented arc lines with gaps
function createSegmentedRingGeometry(radius: number, arcCount = 6, gapFraction = 0.15, segmentsPerArc = 16) {
  const points: THREE.Vector3[] = []
  const arcLength = (Math.PI * 2) / arcCount
  const drawLength = arcLength * (1 - gapFraction)

  for (let a = 0; a < arcCount; a++) {
    const startAngle = a * arcLength
    for (let i = 0; i < segmentsPerArc; i++) {
      const t1 = startAngle + (i / segmentsPerArc) * drawLength
      const t2 = startAngle + ((i + 1) / segmentsPerArc) * drawLength
      points.push(new THREE.Vector3(Math.cos(t1) * radius, 0, Math.sin(t1) * radius))
      points.push(new THREE.Vector3(Math.cos(t2) * radius, 0, Math.sin(t2) * radius))
    }
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

// Helper to create radial tick teeth around a ring
function createRingTicksGeometry(innerR: number, outerR: number, count = 48) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2
    // Longer tick every 4th mark
    const isMajor = i % 4 === 0
    const r2 = isMajor ? outerR * 1.05 : outerR
    points.push(
      new THREE.Vector3(Math.cos(theta) * innerR, 0, Math.sin(theta) * innerR),
      new THREE.Vector3(Math.cos(theta) * r2, 0, Math.sin(theta) * r2)
    )
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

// Helper to create latitude circle
function createLatitudeRingGeometry(sphereR: number, latDeg: number, segments = 64) {
  const phi = (latDeg * Math.PI) / 180
  const y = Math.sin(phi) * sphereR
  const r = Math.cos(phi) * sphereR
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

export function HoloSphere({ drive }: { drive: Drive }) {
  const groupRef = useRef<THREE.Group>(null)
  const gimbal1Ref = useRef<THREE.Group>(null)
  const gimbal2Ref = useRef<THREE.Group>(null)
  const gimbal3Ref = useRef<THREE.Group>(null)
  const equatorRef = useRef<THREE.Group>(null)
  const sphereGridRef = useRef<THREE.Group>(null)
  const nucleusRef = useRef<THREE.Mesh>(null)

  // Color materials
  const goldenColor = useMemo(() => new THREE.Color('#f5a623'), [])
  const brightGold = useMemo(() => new THREE.Color('#ffd15c'), [])
  const whiteGold = useMemo(() => new THREE.Color('#fff9e6'), [])

  // Geometries for the holographic sphere
  const outerSegmentedRing = useMemo(() => createSegmentedRingGeometry(1.95, 8, 0.12, 12), [])
  const outerTicks = useMemo(() => createRingTicksGeometry(1.88, 1.95, 64), [])
  const midCircle = useMemo(() => createCircleGeometry(1.65, 72), [])
  const midTicks = useMemo(() => createRingTicksGeometry(1.60, 1.65, 36), [])
  const innerCircle = useMemo(() => createCircleGeometry(1.25, 60), [])
  const gimbalCircle1 = useMemo(() => createSegmentedRingGeometry(1.75, 4, 0.2, 20), [])
  const gimbalCircle2 = useMemo(() => createSegmentedRingGeometry(1.50, 6, 0.15, 16), [])
  const gimbalCircle3 = useMemo(() => createCircleGeometry(1.35, 64), [])

  // Latitude rings for the sphere shell
  const latNorth = useMemo(() => createLatitudeRingGeometry(1.4, 45, 48), [])
  const latSouth = useMemo(() => createLatitudeRingGeometry(1.4, -45, 48), [])
  const latNorthHigh = useMemo(() => createLatitudeRingGeometry(1.4, 70, 36), [])
  const latSouthHigh = useMemo(() => createLatitudeRingGeometry(1.4, -70, 36), [])

  // Longitude arcs (meridians)
  const meridian1 = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(theta) * 1.4, Math.sin(theta) * 1.4, 0))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])

  const meridian2 = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2
      points.push(new THREE.Vector3(0, Math.sin(theta) * 1.4, Math.cos(theta) * 1.4))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [])

  // Line Materials
  const primaryLineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: goldenColor,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [goldenColor],
  )

  const secondaryLineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: brightGold,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [brightGold],
  )

  const tickLineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: whiteGold,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [whiteGold],
  )

  // Inner Icosahedron Wireframe
  const icosaGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.55, 1), [])
  const icosaWireMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: whiteGold,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [whiteGold],
  )

  // Glowing Core Mesh
  const coreSphereGeo = useMemo(() => new THREE.SphereGeometry(0.28, 24, 24), [])
  const coreSphereMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: whiteGold,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [whiteGold],
  )

  // Node Dots at Key Coordinate Intersections
  const nodeDots = useMemo(() => {
    const positions: number[] = []
    const count = 32
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 1.4
      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      )
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geo
  }, [])

  const nodeDotMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: whiteGold,
        size: 0.045,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [whiteGold],
  )

  // Per-frame animation loop (Smooth 120fps precession rotation & sound reactivity)
  useFrame((state, dt) => {
    const level = drive.level || 0
    const spin = drive.spin || 1
    const color = drive.color || goldenColor

    // Update material colors dynamically to follow theme
    primaryLineMat.color.copy(color)
    secondaryLineMat.color.copy(color).offsetHSL(0.04, 0, 0.15)
    tickLineMat.color.copy(color).offsetHSL(0.06, -0.1, 0.3)
    icosaWireMat.color.copy(color).offsetHSL(0.02, 0, 0.25)
    coreSphereMat.color.copy(color).offsetHSL(0.08, -0.2, 0.4)

    // Base scale with audio responsiveness
    const pulseScale = 1.0 + level * 0.18
    if (groupRef.current) {
      groupRef.current.scale.setScalar(pulseScale)
    }

    // Equator rotation
    if (equatorRef.current) {
      equatorRef.current.rotation.y += dt * 0.45 * spin
    }

    // Gyroscope Gimbal 1 (X/Y precession)
    if (gimbal1Ref.current) {
      gimbal1Ref.current.rotation.y -= dt * 0.35 * spin
      gimbal1Ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2 + 0.65
    }

    // Gyroscope Gimbal 2 (Z/X counter-precession)
    if (gimbal2Ref.current) {
      gimbal2Ref.current.rotation.z += dt * 0.52 * spin
      gimbal2Ref.current.rotation.y = Math.cos(state.clock.elapsedTime * 0.4) * 0.25 - 0.5
    }

    // Gyroscope Gimbal 3 (Tilted meridian)
    if (gimbal3Ref.current) {
      gimbal3Ref.current.rotation.x += dt * 0.28 * spin
      gimbal3Ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.15 + 0.85
    }

    // Spherical Coordinate Matrix
    if (sphereGridRef.current) {
      sphereGridRef.current.rotation.y += dt * 0.18 * spin
      sphereGridRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.08
    }

    // Core Nucleus Pulse
    if (nucleusRef.current) {
      const nScale = 1.0 + level * 0.4 + Math.sin(state.clock.elapsedTime * 4.0) * 0.05
      nucleusRef.current.scale.setScalar(nScale)
      coreSphereMat.opacity = 0.65 + level * 0.35
    }
  })

  return (
    <group ref={groupRef}>
      {/* 1. Main Equatorial Instrument Ring */}
      <group ref={equatorRef}>
        <lineSegments geometry={outerSegmentedRing} material={primaryLineMat} />
        <lineSegments geometry={outerTicks} material={tickLineMat} />
        <lineLoop geometry={midCircle} material={secondaryLineMat} />
        <lineSegments geometry={midTicks} material={tickLineMat} />
        <lineLoop geometry={innerCircle} material={secondaryLineMat} />
      </group>

      {/* 2. Gyroscopic Gimbal Ring 1 (Inclined ~38°) */}
      <group ref={gimbal1Ref} rotation={[0.65, 0, 0.25]}>
        <lineSegments geometry={gimbalCircle1} material={primaryLineMat} />
      </group>

      {/* 3. Gyroscopic Gimbal Ring 2 (Inclined ~-45°) */}
      <group ref={gimbal2Ref} rotation={[-0.75, 0.3, -0.45]}>
        <lineSegments geometry={gimbalCircle2} material={secondaryLineMat} />
      </group>

      {/* 4. Gyroscopic Gimbal Ring 3 (Deep Angle Meridian) */}
      <group ref={gimbal3Ref} rotation={[1.1, -0.2, 0.8]}>
        <lineLoop geometry={gimbalCircle3} material={primaryLineMat} />
      </group>

      {/* 5. 3D Spherical Coordinate Shell (Latitude & Longitude Arcs) */}
      <group ref={sphereGridRef}>
        {/* Latitude circles */}
        <lineLoop geometry={latNorth} material={secondaryLineMat} />
        <lineLoop geometry={latSouth} material={secondaryLineMat} />
        <lineLoop geometry={latNorthHigh} material={tickLineMat} />
        <lineLoop geometry={latSouthHigh} material={tickLineMat} />

        {/* Meridians */}
        <lineLoop geometry={meridian1} material={secondaryLineMat} />
        <lineLoop geometry={meridian2} material={secondaryLineMat} />

        {/* Coordinate node points */}
        <points geometry={nodeDots} material={nodeDotMat} />
      </group>

      {/* 6. Inner Geodesic Core Structure */}
      <mesh geometry={icosaGeometry} material={icosaWireMat} />

      {/* 7. Radiant Golden Energy Nucleus */}
      <mesh ref={nucleusRef} geometry={coreSphereGeo} material={coreSphereMat} />
    </group>
  )
}
