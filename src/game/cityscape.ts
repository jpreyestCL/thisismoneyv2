import * as THREE from 'three'
import {
  CONDOMINIO,
  DISTRITOS,
  LUGARES,
  callesDelMapa,
  type Distrito,
} from './cityMap'
import { addAirliner, buildCondoPark, buildFunPark, buildWaterPark } from './places'
import { PLATUS, TESORO } from './rules'
import { terrainHeight, type Collider } from './world'

const paint = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.84 })

function solid(
  size: [number, number, number],
  color: string,
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), paint(color))
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function hash(x: number, z: number) {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function groundAt(x: number, z: number) {
  return terrainHeight(x, z)
}

export function buildCity(
  group: THREE.Group,
  interactables: THREE.Object3D[],
  colliders: Collider[],
) {
  const city = new THREE.Group()
  city.name = 'ciudad'
  buildRoads(city)
  for (const district of DISTRITOS) buildDistrict(city, district, colliders)
  buildCondo(city, colliders)
  buildLandmarks(city, interactables, colliders)
  buildPlatus(city, interactables, colliders)
  buildTreasureIsland(city, colliders)
  group.add(city)
}

function buildRoads(city: THREE.Group) {
  const roads = new THREE.Group()
  const curb = paint('#d9d3c6')
  for (const street of callesDelMapa()) {
    const y = groundAt(street.cx, street.cz) + 0.16
    const width = street.horizontal ? street.len : 9
    const depth = street.horizontal ? 9 : street.len
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), paint('#2a2f33'))
    asphalt.rotation.x = -Math.PI / 2
    asphalt.position.set(street.cx, y, street.cz)
    asphalt.receiveShadow = true
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(street.horizontal ? street.len * 0.96 : 0.28, street.horizontal ? 0.28 : street.len * 0.96),
      new THREE.MeshBasicMaterial({ color: '#e4c64d' }),
    )
    line.rotation.x = -Math.PI / 2
    line.position.set(street.cx, y + 0.03, street.cz)
    roads.add(asphalt, line)
    const walk = street.horizontal
      ? new THREE.PlaneGeometry(street.len, 2.3)
      : new THREE.PlaneGeometry(2.3, street.len)
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(walk, curb)
      sidewalk.rotation.x = -Math.PI / 2
      sidewalk.receiveShadow = true
      if (street.horizontal) sidewalk.position.set(street.cx, y + 0.02, street.cz + side * 5.7)
      else sidewalk.position.set(street.cx + side * 5.7, y + 0.02, street.cz)
      roads.add(sidewalk)
    }
  }
  city.add(roads)
}

const WALLS = ['#f6efe4', '#f3c9a4', '#f6d56b', '#8fd4cb', '#f08b78', '#d5e2f2', '#f0c3d0']
const ROOFS = ['#e25b45', '#3c6f8f', '#2f6b4f', '#e08a2c', '#6a4c86', '#c4553a']
const clayCache = new Map<string, THREE.MeshStandardMaterial>()
const glass = new THREE.MeshStandardMaterial({
  color: '#9fd4ee', roughness: 0.16, metalness: 0.08, emissive: '#1d4e89', emissiveIntensity: 0.2,
})

function clay(color: string) {
  const cached = clayCache.get(color)
  if (cached) return cached
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.58 })
  clayCache.set(color, material)
  return material
}

function piece(group: THREE.Group, geometry: THREE.BufferGeometry, color: string | THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(geometry, typeof color === 'string' ? clay(color) : color)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

function fortniteHouse(
  city: THREE.Group,
  colliders: Collider[],
  x: number,
  z: number,
  rot: number,
  y: number,
  seed: number,
  maxW = 6.6,
  maxD = 7.2,
) {
  const w = Math.min(maxW, 4.8 + hash(seed, 1) * 1.8)
  const d = Math.min(maxD, 5.2 + hash(seed, 2) * 1.8)
  const floors = hash(seed, 3) > 0.58 ? 2 : 1
  const wall = WALLS[Math.floor(hash(seed, 4) * WALLS.length)]
  const roof = ROOFS[Math.floor(hash(seed, 5) * ROOFS.length)]
  const h = floors === 2 ? 5.5 : 3.25
  const house = new THREE.Group()
  house.position.set(x, y, z)
  house.rotation.y = rot
  piece(house, new THREE.BoxGeometry(w + 0.28, 0.32, d + 0.28), '#c4beb2', 0, 0.16, 0)
  piece(house, new THREE.BoxGeometry(w, h, d), wall, 0, 0.32 + h / 2, 0)
  piece(house, new THREE.BoxGeometry(w + 0.2, 0.16, d + 0.2), '#fffaf3', 0, 0.32 + h, 0)
  const flat = hash(seed, 6) < 0.28
  if (flat) {
    piece(house, new THREE.BoxGeometry(w + 0.35, 0.22, d + 0.35), roof, 0, 0.5 + h, 0)
    piece(house, new THREE.CylinderGeometry(0.55, 0.62, 0.7, 10), '#9aa3ad', w * 0.22, h + 1.05, -d * 0.18)
  } else {
    const cone = new THREE.ConeGeometry(1, 1, 4)
    cone.rotateY(Math.PI / 4)
    const cap = piece(house, cone, roof, 0, 0.32 + h + 0.95, 0)
    cap.scale.set(w * 0.78, 1.9, d * 0.78)
    if (hash(seed, 7) > 0.45) {
      piece(house, new THREE.CylinderGeometry(0.22, 0.26, 1.5, 8), '#9a6b53', w * 0.22, h + 1.7, -d * 0.16)
    }
  }
  piece(house, new THREE.BoxGeometry(1.05, 1.85, 0.12), '#6b3e22', 0, 1.25, d / 2 + 0.04)
  piece(house, new THREE.BoxGeometry(0.85, 0.85, 0.08), glass, -w * 0.28, floors === 2 ? 4.15 : 2.15, d / 2 + 0.05)
  piece(house, new THREE.BoxGeometry(0.85, 0.85, 0.08), glass, w * 0.28, floors === 2 ? 4.15 : 2.15, d / 2 + 0.05)
  if (floors === 2) {
    piece(house, new THREE.BoxGeometry(w * 0.72, 0.12, 1.15), '#efe6d6', 0, 3.35, d / 2 + 0.35)
  }
  const bush = piece(house, new THREE.SphereGeometry(0.55, 10, 8), '#3f8f55', w * 0.42, 0.45, d / 2 + 0.15)
  bush.scale.set(1, 0.75, 1)
  city.add(house)
  colliders.push({ kind: 'box', x, z, halfWidth: w / 2, halfDepth: d / 2, rotation: rot })
}

function stylizedTree(city: THREE.Group, x: number, z: number, y: number, seed: number) {
  const tree = new THREE.Group()
  const scale = 0.85 + hash(seed, 2) * 0.55
  tree.position.set(x, y, z)
  tree.scale.setScalar(scale)
  piece(tree, new THREE.CylinderGeometry(0.22, 0.34, 1.7, 8), '#8a5a3a', 0, 0.85, 0)
  piece(tree, new THREE.SphereGeometry(1.15, 12, 10), hash(seed, 3) > 0.5 ? '#3e9a55' : '#2f7d49', 0, 2.15, 0)
  piece(tree, new THREE.SphereGeometry(0.82, 10, 8), '#67c56a', 0.35, 2.7, 0.15)
  city.add(tree)
}

function fillFronts(city: THREE.Group, colliders: Collider[], district: Distrito, y: number) {
  const margin = 1.4
  const minX = district.x - district.w / 2 + margin
  const maxX = district.x + district.w / 2 - margin
  const minZ = district.z - district.d / 2 + margin
  const maxZ = district.z + district.d / 2 - margin
  const depth = Math.min(7.2, Math.max(5.4, Math.min(district.w, district.d) * 0.2))
  const lot = district.w > 32 ? 6.4 : 6
  const fronts = [
    { along: 'x' as const, from: minX + depth, to: maxX - depth, fixed: maxZ - depth / 2, rot: 0 },
    { along: 'x' as const, from: minX + depth, to: maxX - depth, fixed: minZ + depth / 2, rot: Math.PI },
    { along: 'z' as const, from: minZ + depth, to: maxZ - depth, fixed: maxX - depth / 2, rot: Math.PI / 2 },
    { along: 'z' as const, from: minZ + depth, to: maxZ - depth, fixed: minX + depth / 2, rot: -Math.PI / 2 },
  ]
  fronts.forEach((front, frontIndex) => {
    let cursor = front.from
    let index = 0
    while (cursor + lot <= front.to + 0.2) {
      const along = cursor + lot / 2
      const x = front.along === 'x' ? along : front.fixed
      const z = front.along === 'x' ? front.fixed : along
      fortniteHouse(city, colliders, x, z, front.rot, y, hash(district.x + frontIndex, district.z + index), lot - 0.4, depth - 0.6)
      cursor += lot + 1.5
      index += 1
    }
  })
}

function fillTowers(city: THREE.Group, colliders: Collider[], district: Distrito, y: number) {
  const spots = [[-9, -7], [8, -9], [-7, 9], [11, 6]]
  spots.forEach(([ox, oz], index) => {
    const x = district.x + ox
    const z = district.z + oz
    const floors = 5 + Math.floor(hash(x, z) * 5)
    const tower = new THREE.Group()
    tower.position.set(x, y, z)
    let width = 6.2 - index * 0.25
    let depth = 5.4
    for (let floor = 0; floor < floors; floor++) {
      const shrink = 1 - floor * 0.035
      piece(tower, new THREE.BoxGeometry(width * shrink, 2.7, depth * shrink), floor % 2 ? '#e7eef5' : '#f4f7fb', 0, 1.4 + floor * 2.7, 0)
      piece(tower, new THREE.BoxGeometry(width * shrink * 0.72, 1.15, 0.08), glass, 0, 1.5 + floor * 2.7, depth * shrink * 0.5)
    }
    const crown = piece(tower, new THREE.CylinderGeometry(0.7, 1.3, 2.2, 12), ROOFS[index % ROOFS.length], 0, floors * 2.7 + 1.2, 0)
    crown.scale.set(1, 1, 1)
    piece(tower, new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), '#d7dde4', 0, floors * 2.7 + 3.2, 0)
    city.add(tower)
    colliders.push({ kind: 'box', x, z, halfWidth: width / 2, halfDepth: depth / 2, rotation: 0 })
  })
}

function fillShops(city: THREE.Group, colliders: Collider[], district: Distrito, y: number) {
  const colors = ['#f08b78', '#f6d56b', '#8fd4cb', '#d5e2f2']
  for (let i = 0; i < 4; i++) {
    const x = district.x - 12 + (i % 2) * 16
    const z = district.z - 8 + Math.floor(i / 2) * 16
    if (Math.hypot(x - LUGARES.super.x, z - LUGARES.super.z) < 16) continue
    if (Math.hypot(x - LUGARES.banco.x, z - LUGARES.banco.z) < 16) continue
    if (Math.hypot(x - LUGARES.arcade.x, z - LUGARES.arcade.z) < 12 && district.id === 'arcade' && i < 3) continue
    const shop = new THREE.Group()
    shop.position.set(x, y, z)
    piece(shop, new THREE.BoxGeometry(8.5, 4.2, 6.5), colors[i], 0, 2.2, 0)
    piece(shop, new THREE.BoxGeometry(8.8, 0.35, 2.2), '#e44c35', 0, 4.45, 2.4)
    piece(shop, new THREE.BoxGeometry(5.2, 2.2, 0.1), glass, 0, 2.2, 3.28)
    city.add(shop)
    colliders.push({ kind: 'box', x, z, halfWidth: 4.2, halfDepth: 3.2, rotation: 0 })
  }
  if (district.id === 'arcade') {
    const sign = piece(city, new THREE.TorusGeometry(1.6, 0.28, 8, 18), '#f6d56b', LUGARES.arcade.x, y + 7.2, LUGARES.arcade.z)
    sign.rotation.x = Math.PI / 2
  }
}

function dressPlaza(city: THREE.Group, district: Distrito, y: number) {
  const fountain = new THREE.Group()
  fountain.position.set(LUGARES.fuente.x, y, LUGARES.fuente.z)
  piece(fountain, new THREE.CylinderGeometry(4.2, 4.6, 0.7, 20), '#e7e2d6', 0, 0.4, 0)
  piece(fountain, new THREE.CylinderGeometry(2.6, 2.6, 0.45, 18), '#7ec8d4', 0, 0.85, 0)
  piece(fountain, new THREE.CylinderGeometry(0.35, 0.45, 2.4, 10), '#f4f1ea', 0, 2, 0)
  piece(fountain, new THREE.SphereGeometry(0.55, 12, 10), '#9fd4ee', 0, 3.15, 0)
  city.add(fountain)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    stylizedTree(city, district.x + Math.cos(angle) * 14, district.z + Math.sin(angle) * 14, y, i + 3)
  }
}

function dressWild(city: THREE.Group, district: Distrito, y: number) {
  const desert = district.id.includes('desierto') || district.id.includes('dunas')
  const count = desert ? 8 : 6
  for (let i = 0; i < count; i++) {
    const x = district.x - district.w / 2 + 8 + hash(i, district.x) * (district.w - 16)
    const z = district.z - district.d / 2 + 8 + hash(district.z, i) * (district.d - 16)
    if (desert) {
      const cactus = new THREE.Group()
      cactus.position.set(x, y, z)
      piece(cactus, new THREE.CapsuleGeometry(0.38, 1.8, 4, 8), '#3f9a55', 0, 1.6, 0)
      piece(cactus, new THREE.CapsuleGeometry(0.22, 0.8, 3, 6), '#3f9a55', 0.55, 1.7, 0)
      city.add(cactus)
    } else {
      const palm = new THREE.Group()
      palm.position.set(x, y, z)
      palm.rotation.z = (hash(i, 9) - 0.5) * 0.25
      piece(palm, new THREE.CylinderGeometry(0.18, 0.28, 4.2, 7), '#c48a52', 0, 2.1, 0)
      for (let frond = 0; frond < 5; frond++) {
        const leaf = piece(palm, new THREE.ConeGeometry(0.35, 1.8, 5), '#2f8a45', 0, 4.3, 0)
        leaf.rotation.z = 1.15
        leaf.rotation.y = (frond / 5) * Math.PI * 2
      }
      city.add(palm)
      if (i % 2 === 0) {
        piece(city, new THREE.ConeGeometry(1.5, 0.35, 10), '#e44c35', x + 2.2, y + 2.1, z)
        piece(city, new THREE.CylinderGeometry(0.06, 0.06, 2, 6), '#f4f1ea', x + 2.2, y + 1, z)
      }
    }
  }
}

function buildDistrict(city: THREE.Group, district: Distrito, colliders: Collider[]) {
  const y = groundAt(district.x, district.z)
  const padColor =
    district.id.includes('desierto') || district.id.includes('dunas')
      ? '#c2a36a'
      : district.id === 'playa'
        ? '#e6d3a2'
        : district.tipo === 'deporte'
          ? '#3f7d45'
          : district.tipo === 'parque' || district.tipo === 'hogar' || district.tipo === 'casas'
            ? '#6d9a58'
            : district.tipo === 'plaza'
              ? '#d5d0c4'
              : district.tipo === 'torres'
                ? '#b7b3ac'
                : '#cfc8bb'
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(district.w, district.d), paint(padColor))
  pad.rotation.x = -Math.PI / 2
  pad.position.set(district.x, y + 0.08, district.z)
  pad.receiveShadow = true
  if (district.id !== 'acuatico') city.add(pad)

  if (district.tipo === 'casas') fillFronts(city, colliders, district, y)
  else if (district.tipo === 'torres') fillTowers(city, colliders, district, y)
  else if (district.tipo === 'comercio' || district.tipo === 'ocio') fillShops(city, colliders, district, y)
  else if (district.tipo === 'plaza') dressPlaza(city, district, y)
  else if (district.id === 'parque') buildCondoPark(city, colliders, district.x, district.z, y)
  else if (district.id === 'diversiones') buildFunPark(city, colliders, district.x, district.z, y)
  else if (district.id === 'acuatico') buildWaterPark(city, colliders)
  else if (district.tipo === 'natural') dressWild(city, district, y)
}

function buildCondo(city: THREE.Group, colliders: Collider[]) {
  const district = DISTRITOS.find((item) => item.id === 'casa')
  if (!district) return
  const y = groundAt(district.x, district.z)
  const fenceY = y + 1.1
  const halfW = district.w / 2
  const halfD = district.d / 2
  city.add(
    solid([district.w, 2.2, 0.35], '#d9d3c7', [district.x, fenceY, district.z - halfD]),
    solid([district.w, 2.2, 0.35], '#d9d3c7', [district.x, fenceY, district.z + halfD]),
    solid([0.35, 2.2, district.d], '#d9d3c7', [district.x + halfW, fenceY, district.z]),
  )
  const gateGap = 8
  city.add(
    solid([(halfW - gateGap) / 2, 2.2, 0.35], '#d9d3c7', [district.x - halfW + (halfW - gateGap) / 4, fenceY, district.z]),
    solid([(halfW - gateGap) / 2, 2.2, 0.35], '#d9d3c7', [district.x - 2, fenceY, district.z]),
  )

  for (const lot of CONDOMINIO.lotes) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(lot.w - 0.8, lot.d - 0.8), paint(lot.venta ? '#8fb56a' : '#5f8a52'))
    lawn.rotation.x = -Math.PI / 2
    lawn.position.set(lot.x, y + 0.12, lot.z)
    city.add(lawn)
    if (lot.venta) {
      const sign = solid([2.4, 1.6, 0.15], '#f1cc3a', [lot.x, y + 1.8, lot.z - lot.d / 2 + 1.2])
      sign.name = `plot-${lot.id}`
      city.add(sign)
      continue
    }
    const facingPassage = lot.z > CONDOMINIO.pasaje.z ? Math.PI : 0
    fortniteHouse(
      city,
      colliders,
      lot.x,
      lot.z,
      facingPassage,
      y,
      hash(lot.x, lot.z),
      Math.min(6.2, lot.w - 1),
      Math.min(6.4, lot.d - 2.2),
    )
  }
}

function buildLandmarks(city: THREE.Group, interactables: THREE.Object3D[], colliders: Collider[]) {
  const shopY = groundAt(LUGARES.super.x, LUGARES.super.z)
  const shop = new THREE.Group()
  shop.add(
    solid([16, 8, 12], '#efe6d6', [0, 4, 0]),
    solid([16.4, 1.2, 4], '#e44c35', [0, 8.2, 6.2]),
    solid([3.2, 4.2, 0.3], '#67b7d1', [-4, 4.2, 6.05]),
    solid([3.2, 4.2, 0.3], '#67b7d1', [4, 4.2, 6.05]),
  )
  shop.position.set(LUGARES.super.x, shopY, LUGARES.super.z)
  shop.userData.role = 'shop'
  shop.userData.interaction = 'Súper — E para comprar'
  interactables.push(shop)
  colliders.push({ kind: 'box', x: LUGARES.super.x, z: LUGARES.super.z, halfWidth: 8, halfDepth: 6, rotation: 0 })
  city.add(shop)

  const bankY = groundAt(LUGARES.banco.x, LUGARES.banco.z)
  const bank = new THREE.Group()
  bank.add(solid([18, 7, 10], '#ece7dc', [0, 3.5, 0]), solid([18, 1.4, 11], '#c9c2b3', [0, 7.6, 0]))
  for (const x of [-6, -2, 2, 6]) bank.add(solid([1.1, 7, 1.1], '#f4f1ea', [x, 3.5, 5.4]))
  bank.position.set(LUGARES.banco.x, bankY, LUGARES.banco.z)
  bank.userData.role = 'bank'
  bank.userData.interaction = 'Banco Central — la caja abre más adelante'
  interactables.push(bank)
  colliders.push({ kind: 'box', x: LUGARES.banco.x, z: LUGARES.banco.z, halfWidth: 9, halfDepth: 5, rotation: 0 })
  city.add(bank)

  buildStadium(city, colliders, LUGARES.estadioFutbol.x, LUGARES.estadioFutbol.z, '#2f6b45', 'Estadio de fútbol')
  buildStadium(city, colliders, LUGARES.estadioBasquet.x, LUGARES.estadioBasquet.z, '#c4552b', 'Estadio de básquet')
  buildStadium(city, colliders, LUGARES.estadioTenis.x, LUGARES.estadioTenis.z, '#3d7ea8', 'Estadio de tenis')

  const jailY = groundAt(LUGARES.carcel.x, LUGARES.carcel.z)
  const jail = new THREE.Group()
  jail.add(solid([28, 6, 0.6], '#9aa3a8', [0, 3, -14]), solid([28, 6, 0.6], '#9aa3a8', [0, 3, 14]), solid([0.6, 6, 28], '#9aa3a8', [-14, 3, 0]), solid([0.6, 6, 28], '#9aa3a8', [14, 3, 0]))
  jail.add(solid([16, 5, 10], '#6e767c', [0, 2.5, 0]))
  for (const x of [-12, 12]) {
    for (const z of [-12, 12]) jail.add(solid([2.2, 9, 2.2], '#4d555b', [x, 4.5, z]))
  }
  jail.position.set(LUGARES.carcel.x, jailY, LUGARES.carcel.z)
  jail.userData.role = 'jail'
  jail.userData.interaction = 'Penal La Roca'
  interactables.push(jail)
  colliders.push({ kind: 'box', x: LUGARES.carcel.x, z: LUGARES.carcel.z, halfWidth: 8, halfDepth: 5, rotation: 0 })
  city.add(jail)

  const airY = groundAt(LUGARES.aeropuerto.x, LUGARES.aeropuerto.z)
  const airport = new THREE.Group()
  airport.add(
    solid([90, 0.25, 16], '#d5d8dc', [0, 0.2, 18]),
    solid([22, 8, 14], '#e7eef2', [-28, 4, -8]),
    solid([8, 3, 8], '#f1cc3a', [-28, 9.2, -8]),
  )
  addAirliner(airport)
  airport.position.set(LUGARES.aeropuerto.x, airY, LUGARES.aeropuerto.z)
  airport.userData.role = 'airport'
  airport.userData.interaction = 'Aeropuerto — E para viajar a Platus'
  interactables.push(airport)
  city.add(airport)

  const gas = new THREE.Group()
  const gasY = groundAt(LUGARES.gasolinera.x, LUGARES.gasolinera.z)
  gas.add(solid([14, 0.4, 8], '#e8e6db', [0, 3.2, 0]), solid([0.7, 3.2, 0.7], '#d44b38', [-5, 1.6, 0]), solid([0.7, 3.2, 0.7], '#d44b38', [5, 1.6, 0]))
  gas.position.set(LUGARES.gasolinera.x, gasY, LUGARES.gasolinera.z)
  gas.userData.interaction = 'Gasolinera — el vehículo queda listo'
  interactables.push(gas)
  city.add(gas)
}

function buildStadium(city: THREE.Group, colliders: Collider[], x: number, z: number, color: string, label: string) {
  const y = groundAt(x, z)
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 5, 28, 1, true), paint('#d9d4c8'))
  bowl.position.set(x, y + 2.5, z)
  const field = new THREE.Mesh(new THREE.CircleGeometry(12, 24), paint(color))
  field.rotation.x = -Math.PI / 2
  field.position.set(x, y + 0.2, z)
  const sign = solid([8, 1.2, 0.3], '#f1cc3a', [x, y + 6.2, z - 16])
  sign.name = label
  city.add(bowl, field, sign)
  colliders.push({ kind: 'circle', x, z, radius: 16 })
}

function buildPlatus(city: THREE.Group, interactables: THREE.Object3D[], colliders: Collider[]) {
  const y = groundAt(PLATUS.x, PLATUS.z)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(PLATUS.radius * 0.78, 48), paint('#6d5a78'))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(PLATUS.x, y + 0.2, PLATUS.z)
  city.add(ground)
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2
    const radius = 28 + hash(i, 4) * 70
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(1.4 + hash(i, 8), 6 + hash(i, 2) * 8, 5), paint(i % 2 ? '#7fd0c8' : '#c9a4e0'))
    crystal.position.set(PLATUS.x + Math.cos(angle) * radius, y + 3, PLATUS.z + Math.sin(angle) * radius)
    city.add(crystal)
    colliders.push({ kind: 'circle', x: crystal.position.x, z: crystal.position.z, radius: 1.5 })
  }
  const stall = solid([8, 4, 5], '#3d3148', [PLATUS.x, y + 2, PLATUS.z + 16])
  stall.userData.role = 'return'
  stall.userData.interaction = 'Puesto de Platus — E para volver a la Tierra'
  interactables.push(stall)
  city.add(stall)
}

function buildTreasureIsland(city: THREE.Group, colliders: Collider[]) {
  const y = groundAt(TESORO.x, TESORO.z)
  const sand = new THREE.Mesh(new THREE.CircleGeometry(TESORO.radius * 0.85, 32), paint('#e4d2a1'))
  sand.rotation.x = -Math.PI / 2
  sand.position.set(TESORO.x, y + 0.18, TESORO.z)
  city.add(sand)
  for (const x of [-6, 0, 6]) {
    const column = solid([1.6, 7, 1.6], '#efe6d2', [TESORO.x + x, y + 3.5, TESORO.z])
    city.add(column)
    colliders.push({ kind: 'circle', x: TESORO.x + x, z: TESORO.z, radius: 1.1 })
  }
  city.add(solid([16, 0.6, 6], '#efe6d2', [TESORO.x, y + 7.2, TESORO.z]))
}
