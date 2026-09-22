import * as THREE from 'three'
import { POOL, terrainHeight, type Collider } from './world'

export type Ride = {
  kind: 'spin' | 'swing' | 'wheel'
  object: THREE.Object3D
  speed: number
  cabins?: THREE.Object3D[]
  horses?: { mesh: THREE.Object3D; base: number; phase: number }[]
}

export const rides: Ride[] = []

const clayCache = new Map<string, THREE.MeshStandardMaterial>()

function clay(color: string) {
  const cached = clayCache.get(color)
  if (cached) return cached
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.62 })
  clayCache.set(color, material)
  return material
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), clay(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function block(colliders: Collider[], x: number, z: number, halfWidth: number, halfDepth: number) {
  colliders.push({ kind: 'box', x, z, halfWidth, halfDepth, rotation: 0 })
}

export function tickRides(delta: number, elapsed: number) {
  for (const ride of rides) {
    if (ride.kind === 'swing') ride.object.rotation.z = Math.sin(elapsed * ride.speed) * 0.65
    if (ride.kind === 'spin') {
      ride.object.rotation.y += ride.speed * delta
      for (const horse of ride.horses ?? []) {
        horse.mesh.position.y = horse.base + Math.sin(elapsed * 2.4 + horse.phase) * 0.18
      }
    }
    if (ride.kind === 'wheel') {
      ride.object.rotation.z += ride.speed * delta
      for (const cabin of ride.cabins ?? []) cabin.rotation.z = -ride.object.rotation.z
    }
  }
}

export function buildCondoPark(city: THREE.Group, colliders: Collider[], x: number, z: number, y: number) {
  const park = new THREE.Group()
  park.position.set(x, y, z)
  const path = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 32), clay('#e4d7b4'))
  path.rotation.x = -Math.PI / 2
  path.position.y = 0.06
  const path2 = new THREE.Mesh(new THREE.PlaneGeometry(32, 3.4), clay('#e4d7b4'))
  path2.rotation.x = -Math.PI / 2
  path2.position.y = 0.07
  park.add(path, path2)

  const swing = new THREE.Group()
  swing.position.set(-10, 0, -8)
  box(swing, 0.28, 3.1, 0.28, '#8a5a38', -2.2, 1.55, 0)
  box(swing, 0.28, 3.1, 0.28, '#8a5a38', 2.2, 1.55, 0)
  box(swing, 5, 0.22, 0.22, '#8a5a38', 0, 3.05, 0)
  for (const seatX of [-1.1, 1.1]) {
    const pivot = new THREE.Group()
    pivot.position.set(seatX, 2.95, 0)
    box(pivot, 0.08, 1.7, 0.08, '#5c6570', 0, -0.85, 0)
    box(pivot, 0.9, 0.12, 0.42, '#e25b45', 0, -1.7, 0)
    swing.add(pivot)
    rides.push({ kind: 'swing', object: pivot, speed: 1.5 + seatX })
  }
  park.add(swing)
  block(colliders, x - 12.2, z - 8, 0.4, 0.4)
  block(colliders, x - 7.8, z - 8, 0.4, 0.4)

  const slide = new THREE.Group()
  slide.position.set(9, 0, -8)
  for (let step = 0; step < 4; step++) box(slide, 1.3, 0.28, 0.7, '#c4553a', -1.2, 0.4 + step * 0.55, -1.3 + step * 0.45)
  box(slide, 1.6, 0.2, 1.5, '#c4553a', -1.2, 2.7, 0.5)
  const ramp = box(slide, 1.2, 0.16, 4.2, '#3db7d6', 0.8, 1.45, 1.5)
  ramp.rotation.x = -0.55
  park.add(slide)

  box(park, 1.3, 0.9, 1.3, '#e6d3a2', 8, 0.5, 8)
  box(park, 0.8, 0.7, 0.8, '#efdfb8', 8, 1.2, 8)
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.7, 18), clay('#e7e2d6'))
  bowl.position.set(0, 0.4, 0)
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.12, 16), clay('#7ec8d4'))
  water.position.y = 0.72
  park.add(bowl, water)
  block(colliders, x, z, 2.4, 2.4)
  city.add(park)
}

export function buildFunPark(city: THREE.Group, colliders: Collider[], x: number, z: number, y: number) {
  const park = new THREE.Group()
  park.position.set(x, y, z)
  const avenue = new THREE.Mesh(new THREE.PlaneGeometry(8, 70), clay('#e8d7b0'))
  avenue.rotation.x = -Math.PI / 2
  avenue.position.set(0, 0.05, -8)
  park.add(avenue)

  for (const side of [-6, 6]) {
    box(park, 1.6, 7, 1.6, '#c4552b', side, 3.5, -40)
    block(colliders, x + side, z - 40, 1, 1)
  }
  box(park, 14, 1.1, 1.4, '#c4552b', 0, 7.4, -40)
  for (let i = -3; i <= 3; i++) {
    const colors = ['#e25b45', '#f6d56b', '#3f9a55', '#3db7d6']
    box(park, 0.9, 0.9, 0.9, colors[(i + 3) % 4], i * 1.8, 8.4, -40)
  }

  const castle = new THREE.Group()
  castle.position.set(0, 0, 22)
  box(castle, 16, 8, 10, '#e7eef5', 0, 4, 0)
  box(castle, 2.4, 4.2, 0.4, '#7c4a1e', 0, 2.1, -5.1)
  const tower = (tx: number, tz: number, h: number, color: string) => {
    box(castle, 3.4, h, 3.4, '#f4f7fb', tx, h / 2, tz)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.3, 3.2, 4), clay(color))
    cone.position.set(tx, h + 1.5, tz)
    cone.rotation.y = Math.PI / 4
    cone.castShadow = true
    castle.add(cone)
  }
  tower(-7, -3, 11, '#3c6f8f')
  tower(7, -3, 11, '#3c6f8f')
  tower(0, 2, 15, '#d24b78')
  park.add(castle)
  block(colliders, x, z + 22, 8, 5)

  const wheelRig = new THREE.Group()
  wheelRig.position.set(-28, 0, 4)
  box(wheelRig, 0.8, 12, 0.8, '#6d7580', -2.4, 6, 0)
  box(wheelRig, 0.8, 12, 0.8, '#6d7580', 2.4, 6, 0)
  const wheel = new THREE.Group()
  wheel.position.y = 12
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 8, 28), clay('#e7eef2'))
  wheel.add(ring)
  const cabins: THREE.Object3D[] = []
  const cabinColors = ['#e25b45', '#f6d56b', '#3f9a55', '#3db7d6', '#a56bd4']
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const cabin = new THREE.Group()
    cabin.position.set(Math.cos(angle) * 9, Math.sin(angle) * 9, 0)
    box(cabin, 1.8, 1.5, 1.6, cabinColors[i % cabinColors.length], 0, -0.7, 0)
    wheel.add(cabin)
    cabins.push(cabin)
  }
  wheelRig.add(wheel)
  rides.push({ kind: 'wheel', object: wheel, speed: 0.22, cabins })
  park.add(wheelRig)
  block(colliders, x - 28, z + 4, 4, 3)

  const carousel = new THREE.Group()
  carousel.position.set(26, 0, 2)
  box(carousel, 12, 0.5, 12, '#f3d2b0', 0, 0.3, 0)
  const spin = new THREE.Group()
  spin.position.y = 0.6
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.4, 12), clay('#e25b45'))
  roof.position.y = 4.6
  spin.add(roof)
  box(spin, 0.5, 4.2, 0.5, '#f6d56b', 0, 2.2, 0)
  const horses: Ride['horses'] = []
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2
    const horse = new THREE.Group()
    const hx = Math.cos(angle) * 4.2
    const hz = Math.sin(angle) * 4.2
    horse.position.set(hx, 1.3, hz)
    horse.rotation.y = -angle + Math.PI / 2
    box(horse, 1.5, 0.7, 0.55, i % 2 ? '#f4f1ea' : '#8a5a38', 0, 0.2, 0)
    box(horse, 0.45, 0.55, 0.4, i % 2 ? '#f4f1ea' : '#8a5a38', 0.7, 0.7, 0)
    spin.add(horse)
    horses.push({ mesh: horse, base: 1.3, phase: i })
  }
  carousel.add(spin)
  rides.push({ kind: 'spin', object: spin, speed: 0.45, horses })
  park.add(carousel)
  block(colliders, x + 26, z + 2, 6, 6)

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-24, 2, -16),
    new THREE.Vector3(-8, 8, -16),
    new THREE.Vector3(6, 16, -14),
    new THREE.Vector3(16, 6, -6),
    new THREE.Vector3(18, 12, 4),
    new THREE.Vector3(6, 5, 10),
    new THREE.Vector3(-12, 3, 2),
  ])
  const track = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.45, 8, false), clay('#f4f1ea'))
  track.castShadow = true
  park.add(track)
  city.add(park)
}

export function buildWaterPark(city: THREE.Group, colliders: Collider[]) {
  const y = terrainHeight(POOL.x + POOL.halfW + 10, POOL.z)
  const park = new THREE.Group()
  park.position.set(POOL.x, y, POOL.z)
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(POOL.halfW * 2 + 16, POOL.halfD * 2 + 14), clay('#b7e4f2'))
  deck.rotation.x = -Math.PI / 2
  deck.position.y = 0.04
  park.add(deck)
  box(park, 0.4, 1.1, POOL.halfD * 2 + 1, '#e7eef2', -POOL.halfW - 0.3, 0.6, 0)
  box(park, 0.4, 1.1, POOL.halfD * 2 + 1, '#e7eef2', POOL.halfW + 0.3, 0.6, 0)
  box(park, POOL.halfW * 2 + 1, 1.1, 0.4, '#e7eef2', 0, 0.6, -POOL.halfD - 0.3)
  box(park, POOL.halfW * 2 + 1, 1.1, 0.4, '#e7eef2', 0, 0.6, POOL.halfD + 0.3)
  const slide = box(park, 1.4, 0.2, 7, '#e25b45', POOL.halfW + 4, 3.2, -2)
  slide.rotation.x = -0.7
  box(park, 2.2, 5, 2.2, '#f6d56b', POOL.halfW + 5.5, 2.5, -5)
  city.add(park)
  block(colliders, POOL.x + POOL.halfW + 5.5, POOL.z - 5, 1.2, 1.2)
}

export function addAirliner(parent: THREE.Group) {
  const plane = new THREE.Group()
  plane.position.set(18, 3.2, 16)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 16, 16), clay('#f4f7fb'))
  body.rotation.x = Math.PI / 2
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10), clay('#f4f7fb'))
  nose.position.z = -8
  nose.scale.z = 1.4
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.4, 14), clay('#f4f7fb'))
  tail.rotation.x = -Math.PI / 2
  tail.position.z = 9
  const stripe = box(plane, 0.2, 0.35, 16, '#e25b45', 0, 0.2, 0)
  stripe.position.y = 0.2
  box(plane, 14, 0.18, 2.2, '#d5dde6', 0, 0.1, -1)
  box(plane, 0.2, 2.4, 2.2, '#d5dde6', 0, 1.5, 7)
  plane.add(body, nose, tail)
  parent.add(plane)
}
