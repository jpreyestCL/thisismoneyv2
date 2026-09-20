import * as THREE from 'three'

export const WORLD_SIZE = 1400
export const SEA_LEVEL = -3
export const CITY_LIMIT = 270

const seeded = (x: number, z: number) => {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return value - Math.floor(value)
}

export function terrainHeight(x: number, z: number) {
  const cityBlend = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 235, 360)
  const rolling =
    Math.sin(x * 0.018) * 7 +
    Math.cos(z * 0.016) * 8 +
    Math.sin((x + z) * 0.009) * 11
  const mountainDistance = Math.hypot(x - 360, z + 330)
  const mountain = Math.max(0, 1 - mountainDistance / 430) ** 2 * 185
  const northRange = Math.max(0, (-z - 310) / 500) ** 1.5 * 90
  return 4 + cityBlend * (rolling + mountain + northRange)
}

function terrainColor(height: number, x: number, z: number) {
  if (height < 1) return new THREE.Color('#c7b77a')
  if (height > 125) return new THREE.Color('#d7d8d1')
  if (height > 75) return new THREE.Color('#66745b')
  if (Math.hypot(x + 340, z - 280) < 190) return new THREE.Color('#b49658')
  if (z < -280) return new THREE.Color('#315e38')
  return new THREE.Color('#4f7b45')
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
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 110, 110)
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
  lake.position.set(-355, terrainHeight(-355, 285) + 0.8, 285)
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

  const glassMaterial = new THREE.MeshStandardMaterial({
    color: '#9fd6de',
    emissive: '#172b2e',
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.32,
  })
  const floors = Math.max(2, Math.floor(height / 9))
  for (let floor = 0; floor < floors; floor++) {
    for (const side of [-1, 1]) {
      const windowRow = box([width * 0.64, 2.7, 0.25], '#8ab5bc', [0, 6 + floor * 8, side * (depth / 2 + 0.14)])
      windowRow.material = glassMaterial
      group.add(windowRow)
    }
  }
  if (height > 70) {
    group.add(box([width * 0.45, 4, depth * 0.45], '#3f474c', [0, height + 2, 0]))
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

function createStreetLight(x: number, z: number, rotation: number) {
  const group = new THREE.Group()
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 9, 8),
    new THREE.MeshStandardMaterial({ color: '#202529', metalness: 0.8, roughness: 0.35 }),
  )
  pole.position.y = 4.5
  const lamp = box([2.4, 0.35, 0.7], '#e8dba6', [0.9, 8.7, 0])
  ;(lamp.material as THREE.MeshStandardMaterial).emissive.set('#5d5128')
  group.add(pole, lamp)
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

  for (let i = 0; i < 105; i++) {
    const angle = seeded(i, 10) * Math.PI * 2
    const radius = 320 + seeded(i, 11) * 330
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (Math.hypot(x + 355, z - 285) > 145 && terrainHeight(x, z) > 0) {
      group.add(createTree(x, z, 0.75 + seeded(i, 12) * 0.85))
    }
  }

  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue
    group.add(createStreetLight(i * 80 + 18, -22, Math.PI))
    group.add(createStreetLight(-22, i * 80 + 18, Math.PI / 2))
  }

  const carColors = ['#e44c35', '#e6bd42', '#2a72a5', '#e8e7df', '#262b31']
  const carPositions: [number, number, number, number][] = [
    [18, 6, 102, 0],
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
