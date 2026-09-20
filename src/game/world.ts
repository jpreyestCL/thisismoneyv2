import * as THREE from 'three'

export const WORLD_SIZE = 1500
export const SEA_LEVEL = -3
export const CITY_LIMIT = 270

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

  const cityInfluence = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 220, 335)
  height = THREE.MathUtils.lerp(height, 5, cityInfluence)

  const lakeDistance = Math.hypot(x + 355, z - 285)
  const lakeBasin = 1 - THREE.MathUtils.smoothstep(lakeDistance, 108, 151)
  height = THREE.MathUtils.lerp(height, 6.4, lakeBasin)
  return height
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
      child.castShadow = cast
      child.receiveShadow = receive
    }
  })
}

export interface WorldData {
  group: THREE.Group
  cars: THREE.Group[]
  interactables: THREE.Object3D[]
  water: THREE.Mesh[]
  animated: THREE.Object3D[]
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 170, 170)
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
  ocean.receiveShadow = true

  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(128, 64),
    new THREE.MeshPhysicalMaterial({
      color: '#1d8490',
      roughness: 0.16,
      transparent: true,
      opacity: 0.82,
    }),
  )
  lake.rotation.x = -Math.PI / 2
  lake.position.set(-355, 7.05, 285)
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

function createRoads(group: THREE.Group) {
  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#22272a', roughness: 0.91 })
  const markingMaterial = new THREE.MeshBasicMaterial({ color: '#e4c64d' })
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: '#8a8e89', roughness: 1 })
  const coordinates = [-240, -160, -80, 0, 80, 160, 240]

  for (const value of coordinates) {
    for (const rotation of [0, Math.PI / 2]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(42, 590), roadMaterial)
      road.rotation.set(-Math.PI / 2, 0, rotation)
      road.position.set(rotation ? 0 : value, 5.12, rotation ? value : 0)
      road.receiveShadow = true
      group.add(road)

      const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 590), markingMaterial)
      line.rotation.set(-Math.PI / 2, 0, rotation)
      line.position.set(rotation ? 0 : value, 5.15, rotation ? value : 0)
      group.add(line)
    }
  }

  for (const x of [-280, 280]) {
    const walk = box([14, 1.3, 590], '#8a8e89', [x, 5.5, 0])
    walk.material = sidewalkMaterial
    group.add(walk)
  }
}

function createBuilding(x: number, z: number, index: number) {
  const width = 34 + seeded(index, 1) * 22
  const depth = 34 + seeded(index, 2) * 22
  const height = 24 + seeded(index, 3) * 115
  const colors = ['#b55442', '#dbcfb3', '#7e9196', '#4d5963', '#d1aa6f', '#6e665f']
  const group = new THREE.Group()
  const body = box([width, height, depth], colors[index % colors.length], [0, height / 2, 0])
  group.add(body)

  const warmWindows = index % 4 === 0
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: warmWindows ? '#ffd58a' : '#8fc9d5',
    emissive: warmWindows ? '#b25a19' : '#174557',
    emissiveIntensity: 1.25,
    roughness: 0.25,
    metalness: 0.32,
  })
  const floors = Math.max(2, Math.floor(height / 9))
  for (let floor = 0; floor < floors; floor++) {
    for (const side of [-1, 1]) {
      const windowRow = box([width * 0.64, 2.7, 0.25], '#8ab5bc', [0, 6 + floor * 8, side * (depth / 2 + 0.14)])
      windowRow.material = glassMaterial
      group.add(windowRow)
      const sideWindowRow = box([0.25, 2.7, depth * 0.57], '#8ab5bc', [side * (width / 2 + 0.14), 6 + floor * 8, 0])
      sideWindowRow.material = glassMaterial
      group.add(sideWindowRow)
    }
  }
  const entrance = box([width * 0.28, 4.8, 0.35], '#83c8d7', [0, 2.5, depth / 2 + 0.2])
  entrance.material = glassMaterial
  group.add(entrance)
  if (height > 70) {
    group.add(box([width * 0.45, 4, depth * 0.45], '#3f474c', [0, height + 2, 0]))
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#ff3028', emissive: '#ff1810', emissiveIntensity: 4 }),
    )
    beacon.position.set(0, height + 5, 0)
    group.add(beacon)
  }
  group.position.set(x, 5, z)
  shadow(group)
  return group
}

function createTree(x: number, z: number, scale = 1) {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9 * scale, 1.4 * scale, 9 * scale, 7),
    new THREE.MeshStandardMaterial({ color: '#67462c', roughness: 1 }),
  )
  trunk.position.y = 4.5 * scale
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.3 * scale, 1),
    new THREE.MeshStandardMaterial({
      color: seeded(x, z) > 0.5 ? '#2f6b39' : '#3f793b',
      roughness: 1,
    }),
  )
  crown.position.y = 11.5 * scale
  group.add(trunk, crown)
  group.position.set(x, terrainHeight(x, z), z)
  shadow(group)
  return group
}

interface PlantPoint {
  x: number
  y: number
  z: number
  scale: number
  rotation: number
}

function createVegetation() {
  const vegetation = new THREE.Group()
  vegetation.name = 'vegetation'
  const broadleaf: PlantPoint[] = []
  const jungle: PlantPoint[] = []
  const conifers: PlantPoint[] = []
  const cacti: PlantPoint[] = []

  for (let i = 0; i < 1650; i++) {
    const x = (seeded(i, 91) * 2 - 1) * 655
    const z = (seeded(i, 117) * 2 - 1) * 655
    if (Math.max(Math.abs(x), Math.abs(z)) < 315) continue
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
    castShadow = true,
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
  return vegetation
}

function createStreetLight(x: number, z: number, rotation: number) {
  const group = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 9, 8),
    new THREE.MeshStandardMaterial({ color: '#202529', metalness: 0.8, roughness: 0.35 }),
  )
  pole.position.y = 4.5
  const lamp = box([2.4, 0.35, 0.7], '#e8dba6', [0.9, 8.7, 0])
  ;(lamp.material as THREE.MeshStandardMaterial).emissive.set('#5d5128')
  ;(lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2
  const light = new THREE.PointLight('#ffe1a3', 38, 26, 2)
  light.position.set(0.9, 8.25, 0)
  group.add(pole, lamp, light)
  group.position.set(x, 5.8, z)
  group.rotation.y = rotation
  return group
}

export function createCar(color = '#e7442e') {
  const car = new THREE.Group()
  car.name = 'vehicle'
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

function createLandmarks(group: THREE.Group, interactables: THREE.Object3D[]) {
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(43, 43, 1.2, 48),
    new THREE.MeshStandardMaterial({ color: '#bdb9a8', roughness: 0.95 }),
  )
  plaza.position.set(0, 5.7, 0)
  plaza.receiveShadow = true
  group.add(plaza)

  const tower = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 15, 5, 12),
    new THREE.MeshStandardMaterial({ color: '#5d6468' }),
  )
  base.position.y = 2.5
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 4.5, 42, 10),
    new THREE.MeshStandardMaterial({ color: '#d9d4c5', roughness: 0.8 }),
  )
  beam.position.y = 26
  const globe = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6, 2),
    new THREE.MeshStandardMaterial({ color: '#e7a52b', emissive: '#6b3f00', emissiveIntensity: 0.45 }),
  )
  globe.position.y = 50
  tower.add(base, beam, globe)
  tower.position.set(0, 6, 0)
  tower.userData.interaction = 'Mirador Central — punto de referencia desbloqueado'
  interactables.push(tower)
  shadow(tower)
  group.add(tower)

  const gasStation = new THREE.Group()
  gasStation.add(
    box([30, 1.5, 18], '#e8e6db', [0, 9, 0]),
    box([5, 9, 5], '#d44b38', [-11, 4.5, 0]),
    box([5, 9, 5], '#d44b38', [11, 4.5, 0]),
  )
  gasStation.position.set(202, 6, 117)
  gasStation.userData.interaction = 'Estación Norte — vehículo reparado y combustible al máximo'
  interactables.push(gasStation)
  group.add(gasStation)
}

export function createWorld(): WorldData {
  const group = new THREE.Group()
  const cars: THREE.Group[] = []
  const interactables: THREE.Object3D[] = []
  const animated: THREE.Object3D[] = []
  const water = createWater()
  group.add(createTerrain(), ...water)
  createRoads(group)

  let buildingIndex = 0
  const blocks = [-200, -120, -40, 40, 120, 200]
  for (const x of blocks) {
    for (const z of blocks) {
      if (Math.abs(x) < 70 && Math.abs(z) < 70) continue
      if (seeded(x, z) < 0.14) continue
      group.add(createBuilding(x, z, buildingIndex++))
    }
  }

  group.add(createVegetation())
  const parkTrees: [number, number][] = [
    [-58, -58], [58, -58], [-58, 58], [58, 58],
    [-265, -264], [-265, 264], [265, -264], [265, 264],
  ]
  parkTrees.forEach(([x, z], index) => group.add(createTree(x, z, 0.75 + (index % 3) * 0.12)))

  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue
    group.add(createStreetLight(i * 80 + 18, -22, Math.PI))
    group.add(createStreetLight(-22, i * 80 + 18, Math.PI / 2))
  }

  const carColors = ['#e44c35', '#e6bd42', '#2a72a5', '#e8e7df', '#262b31']
  const carPositions: [number, number, number, number][] = [
    [242, 6, 235, 0],
    [-98, 6, -18, Math.PI / 2],
    [178, 6, -95, 0],
    [-178, 6, 180, Math.PI / 2],
    [95, 6, 220, Math.PI / 2],
  ]
  carPositions.forEach(([x, y, z, rotation], index) => {
    const car = createCar(carColors[index])
    car.position.set(x, y, z)
    car.rotation.y = rotation
    cars.push(car)
    group.add(car)
  })

  createLandmarks(group, interactables)
  return { group, cars, interactables, water, animated }
}
