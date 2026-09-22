import * as THREE from 'three'
import { buildCity } from './cityscape'

export const WORLD_SIZE = 1500
export const SEA_LEVEL = -3
export const CITY_LIMIT = 270
export const LAKE_X = -355
export const LAKE_Z = 285
export const LAKE_RADIUS = 128
export const LAKE_SURFACE = 7.05
export const CITY_ROADS = [-240, -160, -80, 0, 80, 160, 240]
export const ROAD_LENGTH = 590

const seeded = (x: number, z: number) => {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return value - Math.floor(value)
}

const latticeNoise = (x: number, z: number) => {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const tx = x - x0
  const tz = z - z0
  const sx = tx * tx * (3 - 2 * tx)
  const sz = tz * tz * (3 - 2 * tz)
  const a = seeded(x0, z0)
  const b = seeded(x0 + 1, z0)
  const c = seeded(x0, z0 + 1)
  const d = seeded(x0 + 1, z0 + 1)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sz)
}

const fbm = (x: number, z: number, octaves = 5) => {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  for (let octave = 0; octave < octaves; octave++) {
    value += (latticeNoise(x * frequency, z * frequency) * 2 - 1) * amplitude
    amplitude *= 0.5
    frequency *= 2.03
  }
  return value
}

const peak = (x: number, z: number, px: number, pz: number, radius: number, height: number) => {
  const distance = Math.hypot(x - px, z - pz) / radius
  if (distance >= 1) return 0
  const ridge = 1 - distance
  return ridge * ridge * (3 - 2 * ridge) * height
}

export type Biome = 'ocean' | 'beach' | 'plains' | 'forest' | 'darkForest' | 'jungle' | 'desert' | 'alpine' | 'snow'

export function biomeAt(x: number, z: number, height = terrainHeight(x, z)): Biome {
  if (height < SEA_LEVEL + 0.7) return 'ocean'
  if (height < 3.2) return 'beach'
  if (height > 112) return 'snow'
  if (height > 72) return 'alpine'
  if (x < -180 && z > 70) return 'jungle'
  if (x < -110 && z < -170) return 'darkForest'
  if (z < -180) return 'forest'
  if (x > 250 && z > 80) return 'desert'
  return 'plains'
}

export function terrainHeight(x: number, z: number) {
  const angle = Math.atan2(z, x)
  const coastVariation =
    Math.sin(angle * 3 + 0.7) * 31 +
    Math.sin(angle * 7 - 1.1) * 18 +
    fbm(x * 0.006, z * 0.006, 4) * 66
  const coastRadius = 620 + coastVariation
  const radialDistance = Math.hypot(x * 0.96, z)
  const island = 1 - THREE.MathUtils.smoothstep(radialDistance, coastRadius - 85, coastRadius + 22)

  const broadHills = fbm(x * 0.006 + 21, z * 0.006 - 8, 5) * 34
  const fineRelief = fbm(x * 0.019 - 14, z * 0.019 + 27, 4) * 8
  const rolling = Math.sin(x * 0.011) * 5 + Math.sin((x + z) * 0.008) * 7
  const mountains =
    peak(x, z, 305, -355, 330, 158) +
    peak(x, z, 455, -265, 250, 142) +
    peak(x, z, 175, -485, 235, 126) +
    peak(x, z, 410, -485, 190, 105)
  const mountainDetail = mountains > 5 ? Math.abs(fbm(x * 0.025, z * 0.025, 4)) * mountains * 0.24 : 0
  let height = SEA_LEVEL - 18 + island * (26 + broadHills + fineRelief + rolling + mountains + mountainDetail)

  const cityInfluence = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 300, 430)
  height = THREE.MathUtils.lerp(height, 5, cityInfluence)

  const lakeDistance = Math.hypot(x - LAKE_X, z - LAKE_Z)
  const shore = 1 - THREE.MathUtils.smoothstep(lakeDistance, 96, 140)
  height = THREE.MathUtils.lerp(height, LAKE_SURFACE + 0.15, shore)
  const basin = 1 - THREE.MathUtils.smoothstep(lakeDistance, 18, 78)
  height = THREE.MathUtils.lerp(height, 0.6, basin)
  height = blendDisc(height, x, z, 0, 520, 150, 22)
  height = blendDisc(height, x, z, -520, -420, 78, 8)
  return height
}

function blendDisc(height: number, x: number, z: number, cx: number, cz: number, radius: number, top: number) {
  const distance = Math.hypot(x - cx, z - cz)
  if (distance > radius) return height
  const rim = THREE.MathUtils.smoothstep(distance, radius * 0.72, radius)
  return THREE.MathUtils.lerp(top, height, rim)
}

export function waterSurfaceAt(x: number, z: number, terrain = terrainHeight(x, z)) {
  if (Math.hypot(x - LAKE_X, z - LAKE_Z) <= LAKE_RADIUS && terrain < LAKE_SURFACE + 0.2) return LAKE_SURFACE
  if (terrain < SEA_LEVEL + 0.5) return SEA_LEVEL
  return null
}

function terrainColor(height: number, x: number, z: number) {
  const biome = biomeAt(x, z, height)
  if (biome === 'ocean') return new THREE.Color('#b5a66a')
  if (biome === 'beach') return new THREE.Color('#d5c184')
  if (biome === 'snow') return new THREE.Color(height > 145 ? '#f6f7f4' : '#dce5e5')
  if (biome === 'alpine') return new THREE.Color(height > 92 ? '#75807a' : '#596959')
  if (biome === 'jungle') return new THREE.Color('#255f35')
  if (biome === 'darkForest') return new THREE.Color('#1e452d')
  if (biome === 'forest') return new THREE.Color('#37633a')
  if (biome === 'desert') return new THREE.Color('#a8894f')
  return new THREE.Color('#568249')
}

const shadow = (object: THREE.Object3D, cast = true, receive = true) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = Array.isArray(child.material) ? child.material[0] : child.material
      child.castShadow = cast && !(material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0)
      child.receiveShadow = receive
    }
  })
}

export type Collider =
  | { kind: 'circle'; x: number; z: number; radius: number }
  | { kind: 'box'; x: number; z: number; halfWidth: number; halfDepth: number; rotation: number }

export interface WorldData {
  group: THREE.Group
  cars: THREE.Group[]
  interactables: THREE.Object3D[]
  water: THREE.Mesh[]
  animated: THREE.Object3D[]
  colliders: Collider[]
}

export function carCollider(car: THREE.Object3D): Collider {
  return {
    kind: 'box',
    x: car.position.x,
    z: car.position.z,
    halfWidth: 2.55,
    halfDepth: 4.4,
    rotation: car.rotation.y,
  }
}

function resolveCircleCollider(
  x: number,
  z: number,
  radius: number,
  collider: Extract<Collider, { kind: 'circle' }>,
) {
  const dx = x - collider.x
  const dz = z - collider.z
  const minDistance = radius + collider.radius
  const distanceSq = dx * dx + dz * dz
  if (distanceSq >= minDistance * minDistance) return { x, z }
  const distance = Math.sqrt(distanceSq)
  if (distance < 1e-6) return { x: collider.x + minDistance, z: collider.z }
  const scale = minDistance / distance
  return { x: collider.x + dx * scale, z: collider.z + dz * scale }
}

function resolveBoxCollider(
  x: number,
  z: number,
  radius: number,
  collider: Extract<Collider, { kind: 'box' }>,
) {
  const cos = Math.cos(collider.rotation)
  const sin = Math.sin(collider.rotation)
  const dx = x - collider.x
  const dz = z - collider.z
  let localX = dx * cos - dz * sin
  let localZ = dx * sin + dz * cos
  const closestX = THREE.MathUtils.clamp(localX, -collider.halfWidth, collider.halfWidth)
  const closestZ = THREE.MathUtils.clamp(localZ, -collider.halfDepth, collider.halfDepth)
  const inside =
    Math.abs(localX) <= collider.halfWidth && Math.abs(localZ) <= collider.halfDepth

  if (inside) {
    const gapX = collider.halfWidth - Math.abs(localX)
    const gapZ = collider.halfDepth - Math.abs(localZ)
    if (gapX < gapZ) localX = (localX < 0 ? -1 : 1) * (collider.halfWidth + radius)
    else localZ = (localZ < 0 ? -1 : 1) * (collider.halfDepth + radius)
  } else {
    const offsetX = localX - closestX
    const offsetZ = localZ - closestZ
    const distanceSq = offsetX * offsetX + offsetZ * offsetZ
    if (distanceSq >= radius * radius) return { x, z }
    const distance = Math.sqrt(distanceSq) || 1e-6
    const push = (radius - distance) / distance
    localX += offsetX * push
    localZ += offsetZ * push
  }

  return {
    x: collider.x + localX * cos + localZ * sin,
    z: collider.z - localX * sin + localZ * cos,
  }
}

export function separateFromColliders(
  x: number,
  z: number,
  radius: number,
  ...groups: Collider[][]
) {
  let nextX = x
  let nextZ = z
  for (let pass = 0; pass < 3; pass++) {
    for (const colliders of groups) {
      for (const collider of colliders) {
        const reach =
          collider.kind === 'circle'
            ? radius + collider.radius
            : radius + collider.halfWidth + collider.halfDepth
        if (Math.abs(nextX - collider.x) > reach || Math.abs(nextZ - collider.z) > reach) continue
        const resolved =
          collider.kind === 'circle'
            ? resolveCircleCollider(nextX, nextZ, radius, collider)
            : resolveBoxCollider(nextX, nextZ, radius, collider)
        nextX = resolved.x
        nextZ = resolved.z
      }
    }
  }
  return { x: nextX, z: nextZ }
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 104, 104)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors: number[] = []
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const height = terrainHeight(x, z)
    positions.setY(i, height)
    const color = terrainColor(height, x, z)
    const variation = 0.88 + seeded(x, z) * 0.18
    colors.push(color.r * variation, color.g * variation, color.b * variation)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }),
  )
  terrain.receiveShadow = true
  return terrain
}

function createWater() {
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE * 2.4, WORLD_SIZE * 2.4),
    new THREE.MeshPhysicalMaterial({
      color: '#087c99',
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
      transmission: 0.1,
    }),
  )
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = SEA_LEVEL
  ocean.userData.surface = SEA_LEVEL
  ocean.receiveShadow = true
  const oceanMaterial = ocean.material as THREE.MeshPhysicalMaterial
  oceanMaterial.opacity = 0.58
  oceanMaterial.depthWrite = false
  oceanMaterial.side = THREE.DoubleSide

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE_RADIUS, 64),
    new THREE.MeshPhysicalMaterial({
      color: '#1d8490',
      roughness: 0.16,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  lake.rotation.x = -Math.PI / 2
  lake.position.set(LAKE_X, LAKE_SURFACE, LAKE_Z)
  lake.userData.surface = LAKE_SURFACE
  return [ocean, lake]
}

function box(
  size: [number, number, number],
  color: THREE.ColorRepresentation,
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
  )
  mesh.position.set(...position)
  return mesh
}

interface PlantPoint {
  x: number
  y: number
  z: number
  scale: number
  rotation: number
}

function createVegetation(colliders: Collider[]) {
  const vegetation = new THREE.Group()
  vegetation.name = 'vegetation'
  const broadleaf: PlantPoint[] = []
  const jungle: PlantPoint[] = []
  const conifers: PlantPoint[] = []
  const cacti: PlantPoint[] = []

  for (let i = 0; i < 1200; i++) {
    const x = (seeded(i, 91) * 2 - 1) * 655
    const z = (seeded(i, 117) * 2 - 1) * 655
    if (Math.max(Math.abs(x), Math.abs(z)) < 360) continue
    if (Math.hypot(x, z - 520) < 160) continue
    if (Math.hypot(x + 520, z + 420) < 90) continue
    if (Math.hypot(x + 355, z - 285) < 166) continue
    const y = terrainHeight(x, z)
    const biome = biomeAt(x, z, y)
    const point = {
      x,
      y,
      z,
      scale: 0.65 + seeded(i, 141) * 1.05,
      rotation: seeded(i, 163) * Math.PI * 2,
    }
    const densityRoll = seeded(i, 177)
    if (biome === 'jungle' && densityRoll < 0.83) jungle.push(point)
    else if (biome === 'darkForest' && densityRoll < 0.79) conifers.push(point)
    else if (biome === 'forest' && densityRoll < 0.7) {
      if (densityRoll < 0.33) conifers.push(point)
      else broadleaf.push(point)
    } else if (biome === 'alpine' && y < 108 && densityRoll < 0.42) conifers.push({ ...point, scale: point.scale * 0.8 })
    else if (biome === 'plains' && densityRoll < 0.1) broadleaf.push({ ...point, scale: point.scale * 0.85 })
    else if (biome === 'desert' && densityRoll < 0.13) cacti.push({ ...point, scale: point.scale * 0.7 })
  }

  const dummy = new THREE.Object3D()
  const createPart = (
    points: PlantPoint[],
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    verticalOffset: number,
    scaleMultiplier: THREE.Vector3,
    castShadow = false,
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, material, points.length)
    points.forEach((point, index) => {
      dummy.position.set(point.x, point.y + verticalOffset * point.scale, point.z)
      dummy.rotation.set(0, point.rotation, 0)
      dummy.scale.copy(scaleMultiplier).multiplyScalar(point.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.castShadow = castShadow
    mesh.receiveShadow = true
    mesh.instanceMatrix.needsUpdate = true
    vegetation.add(mesh)
  }

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#5c3c25', roughness: 1 })
  createPart(broadleaf, new THREE.CylinderGeometry(0.55, 0.9, 7.5, 6), trunkMaterial, 3.75, new THREE.Vector3(1, 1, 1))
  createPart(
    broadleaf,
    new THREE.IcosahedronGeometry(4.4, 1),
    new THREE.MeshStandardMaterial({ color: '#3d783c', roughness: 1 }),
    9.2,
    new THREE.Vector3(1.1, 0.95, 1.1),
  )

  createPart(jungle, new THREE.CylinderGeometry(0.65, 1.05, 9, 7), trunkMaterial, 4.5, new THREE.Vector3(1, 1, 1))
  createPart(
    jungle,
    new THREE.IcosahedronGeometry(5.2, 1),
    new THREE.MeshStandardMaterial({ color: '#176332', roughness: 0.95 }),
    10.6,
    new THREE.Vector3(1.35, 0.83, 1.35),
  )
  createPart(
    jungle,
    new THREE.IcosahedronGeometry(3.4, 1),
    new THREE.MeshStandardMaterial({ color: '#2c8140', roughness: 0.95 }),
    13,
    new THREE.Vector3(1.1, 0.65, 1.1),
    false,
  )

  createPart(conifers, new THREE.CylinderGeometry(0.45, 0.8, 8, 6), trunkMaterial, 4, new THREE.Vector3(1, 1, 1))
  createPart(
    conifers,
    new THREE.ConeGeometry(4.6, 10.5, 8),
    new THREE.MeshStandardMaterial({ color: '#183e2b', roughness: 1 }),
    9.3,
    new THREE.Vector3(1, 1, 1),
  )
  createPart(
    conifers,
    new THREE.ConeGeometry(3.5, 8, 8),
    new THREE.MeshStandardMaterial({ color: '#28553a', roughness: 1 }),
    13,
    new THREE.Vector3(1, 1, 1),
    false,
  )

  const cactusMaterial = new THREE.MeshStandardMaterial({ color: '#507845', roughness: 0.92 })
  createPart(cacti, new THREE.CylinderGeometry(0.65, 0.85, 7, 7), cactusMaterial, 3.5, new THREE.Vector3(1, 1, 1))

  const addTrunks = (points: PlantPoint[], radius: number) => {
    for (const point of points) {
      colliders.push({ kind: 'circle', x: point.x, z: point.z, radius: radius * point.scale })
    }
  }
  addTrunks(broadleaf, 1.15)
  addTrunks(jungle, 1.3)
  addTrunks(conifers, 1.05)
  addTrunks(cacti, 1)
  return vegetation
}

function createCar(color: string) {
  const car = new THREE.Group()
  const body = box([4.5, 1.2, 8.2], color, [0, 1.4, 0])
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 1.4, 4.1),
    new THREE.MeshStandardMaterial({
      color: '#293c48',
      metalness: 0.5,
      roughness: 0.24,
      transparent: true,
      opacity: 0.92,
    }),
  )
  cabin.position.set(0, 2.55, -0.3)
  car.add(body, cabin)
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.88 })
  for (const x of [-2.1, 2.1]) {
    for (const z of [-2.55, 2.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 0.55, 16), wheelMaterial)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(x, 0.75, z)
      wheel.name = 'wheel'
      car.add(wheel)
    }
  }
  shadow(car)
  return car
}

export function createWorld(): WorldData {
  const group = new THREE.Group()
  const cars: THREE.Group[] = []
  const interactables: THREE.Object3D[] = []
  const animated: THREE.Object3D[] = []
  const colliders: Collider[] = []
  const water = createWater()
  group.add(createTerrain(), ...water)
  buildCity(group, interactables, colliders)
  group.add(createVegetation(colliders))

  const carColors = ['#e44c35', '#e6bd42', '#2a72a5', '#e8e7df', '#262b31']
  const carSpots: [number, number, number][] = [
    [0, 40, 0],
    [55, -30, Math.PI / 2],
    [-55, 36, Math.PI / 2],
    [18, -70, 0],
    [-36, 78, 0],
  ]
  carSpots.forEach(([x, z, rotation], index) => {
    const car = createCar(carColors[index])
    car.position.set(x, terrainHeight(x, z) + 0.4, z)
    car.rotation.y = rotation
    cars.push(car)
    group.add(car)
  })

  return { group, cars, interactables, water, animated, colliders }
}
