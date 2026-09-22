import * as THREE from 'three'
import {
  CONDOMINIO,
  DISTRITOS,
  LUGARES,
  callesDelMapa,
  distritoEn,
  loteEn,
  type Distrito,
} from './cityMap'
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
  for (const street of callesDelMapa()) {
    const y = groundAt(street.cx, street.cz) + 0.16
    const width = street.horizontal ? street.len : 9
    const depth = street.horizontal ? 9 : street.len
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), paint('#2a2f33'))
    asphalt.rotation.x = -Math.PI / 2
    asphalt.position.set(street.cx, y, street.cz)
    asphalt.receiveShadow = true
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(street.horizontal ? street.len : 0.28, street.horizontal ? 0.28 : street.len),
      new THREE.MeshBasicMaterial({ color: '#e4c64d' }),
    )
    line.rotation.x = -Math.PI / 2
    line.position.set(street.cx, y + 0.03, street.cz)
    roads.add(asphalt, line)
  }
  city.add(roads)
}

function buildDistrict(city: THREE.Group, district: Distrito, colliders: Collider[]) {
  const y = groundAt(district.x, district.z)
  const padColor =
    district.tipo === 'natural' && district.id.includes('desierto')
      ? '#c2a36a'
      : district.tipo === 'natural'
        ? '#d7c48a'
        : district.tipo === 'deporte'
          ? '#3f7d45'
          : district.tipo === 'parque' || district.tipo === 'hogar'
            ? '#6d9a58'
            : district.tipo === 'plaza'
              ? '#c9c3b4'
              : '#8e948f'
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(district.w, district.d), paint(padColor))
  pad.rotation.x = -Math.PI / 2
  pad.position.set(district.x, y + 0.08, district.z)
  pad.receiveShadow = true
  city.add(pad)

  if (district.id === 'casa' || district.tipo === 'deporte' || district.tipo === 'natural' || district.tipo === 'aeropuerto' || district.tipo === 'parque') {
    return
  }

  const cols = district.w > 50 ? 2 : 3
  const rows = district.d > 50 ? 2 : 3
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = district.x - district.w / 2 + (district.w / cols) * (col + 0.5)
      const z = district.z - district.d / 2 + (district.d / rows) * (row + 0.5)
      if (loteEn(x, z) || distritoEn(x, z)?.id !== district.id) continue
      const roll = hash(x, z)
      const width = district.w / cols * 0.62
      const depth = district.d / rows * 0.62
      const height = district.tipo === 'torres' ? 28 + roll * 36 : 10 + roll * 16
      const colors = ['#b55442', '#d8c7a2', '#7e9196', '#4d5963', '#c49255']
      const block = solid([width, height, depth], colors[Math.floor(roll * colors.length) % colors.length], [x, y + height / 2, z])
      city.add(block)
      colliders.push({ kind: 'box', x, z, halfWidth: width / 2, halfDepth: depth / 2, rotation: 0 })
    }
  }
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
    const house = new THREE.Group()
    house.add(
      solid([lot.w - 2.4, 6.5, lot.d - 5], '#e7d7c3', [0, 3.3, 0]),
      solid([lot.w - 1.6, 1.4, lot.d - 4.2], '#8d4b3a', [0, 7.2, 0]),
    )
    house.position.set(lot.x, y, lot.z)
    city.add(house)
    colliders.push({ kind: 'box', x: lot.x, z: lot.z, halfWidth: (lot.w - 2.4) / 2, halfDepth: (lot.d - 5) / 2, rotation: 0 })
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
  airport.position.set(LUGARES.aeropuerto.x, airY, LUGARES.aeropuerto.z)
  airport.userData.role = 'airport'
  airport.userData.interaction = 'Aeropuerto — E para viajar a Platus'
  interactables.push(airport)
  city.add(airport)

  const poolY = groundAt(LUGARES.parqueAcuatico.x, LUGARES.parqueAcuatico.z)
  const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 28), paint('#1d8490'))
  pool.rotation.x = -Math.PI / 2
  pool.position.set(LUGARES.parqueAcuatico.x, poolY + 0.2, LUGARES.parqueAcuatico.z)
  city.add(pool, solid([4, 10, 4], '#e7e4dc', [LUGARES.parqueAcuatico.x + 18, poolY + 5, LUGARES.parqueAcuatico.z]))

  const wheelY = groundAt(LUGARES.parqueDiversiones.x, LUGARES.parqueDiversiones.z)
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(10, 0.6, 10, 28), paint('#e44c35'))
  wheel.position.set(LUGARES.parqueDiversiones.x, wheelY + 12, LUGARES.parqueDiversiones.z)
  city.add(wheel, solid([3, 12, 3], '#5c656c', [LUGARES.parqueDiversiones.x, wheelY + 6, LUGARES.parqueDiversiones.z]))

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
