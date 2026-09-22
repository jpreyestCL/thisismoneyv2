import * as THREE from 'three'
import {
  biomeAt,
  carCollider,
  createWorld,
  LAKE_X,
  LAKE_Z,
  separateFromColliders,
  terrainHeight,
  waterSurfaceAt,
  WORLD_SIZE,
  type Collider,
} from './world'
import { CoreLoop, type LoopSave } from './coreLoop'
import { LUGARES, distritoEn } from './cityMap'
import type { BuildKind } from './rules'

const PLAYER_RADIUS = 0.95
const VEHICLE_RADIUS = 2.85

export interface GameSnapshot {
  speed: number
  district: string
  time: string
  health: number
  stamina: number
  money: number
  inVehicle: boolean
  nearbyAction: string | null
  missionDistance: number
  missionComplete: boolean
  swimming: boolean
  afloat: boolean
  onSeabed: boolean
  phase: 'day' | 'night'
  phaseLabel: string
  objectiveTitle: string
  objectiveText: string
  objectiveHint: string
  shopOpen: boolean
  buildMode: boolean
  buildKind: BuildKind
  inventory: { wall: number; floor: number; ramp: number }
  shopItems: { key: string; name: string; price: number; locked: boolean }[]
}

export interface MapState {
  x: number
  z: number
  yaw: number
  missionX: number
  missionZ: number
  missionVisible: boolean
}

export type GameInput = 'forward' | 'backward' | 'left' | 'right' | 'sprint' | 'jump'

interface SavedGame {
  x: number
  y: number
  z: number
  yaw: number
  missionComplete: boolean
  loop?: LoopSave
}

const SAVE_KEY = 'this-is-money-save-v1'

const keys: Record<string, GameInput> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  Space: 'jump',
}

function createCharacter() {
  const character = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: '#a96b45', roughness: 0.84 })
  const clothes = new THREE.MeshStandardMaterial({ color: '#ef622f', roughness: 0.9 })
  const dark = new THREE.MeshStandardMaterial({ color: '#202b35', roughness: 0.95 })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 1.25, 6, 10), clothes)
  torso.position.y = 2.35
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), skin)
  head.position.y = 3.85
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark)
  hair.position.y = 4
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 1.1, 4, 8), dark)
  const rightLeg = leftLeg.clone()
  leftLeg.position.set(-0.36, 0.8, 0)
  rightLeg.position.set(0.36, 0.8, 0)
  leftLeg.name = 'leftLeg'
  rightLeg.name = 'rightLeg'

  const createArm = (side: 'left' | 'right') => {
    const direction = side === 'left' ? -1 : 1
    const arm = new THREE.Group()
    arm.name = `${side}Arm`
    arm.position.set(direction * 0.82, 3, 0)
    arm.rotation.z = direction * 0.12
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.72, 4, 8), clothes)
    sleeve.position.y = -0.5
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin)
    hand.position.y = -1.22
    arm.add(sleeve, hand)
    return arm
  }
  const leftArm = createArm('left')
  const rightArm = createArm('right')
  character.add(torso, head, hair, leftLeg, rightLeg, leftArm, rightArm)
  character.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return character
}

function districtName(x: number, z: number) {
  const district = distritoEn(x, z)
  if (district) return district.nombre
  if (Math.hypot(x - LAKE_X, z - LAKE_Z) < 190) return 'Lago Espejo'
  const biome = biomeAt(x, z)
  if (biome === 'snow' || biome === 'alpine') return 'Cordillera Blanca'
  if (biome === 'jungle') return 'Selva Esmeralda'
  if (biome === 'darkForest') return 'Bosque Umbrío'
  if (biome === 'forest') return 'Bosque del Norte'
  if (biome === 'desert') return 'Tierras Doradas'
  if (x < -280) return 'Costa Oeste'
  return 'Praderas del Sur'
}

export class GameEngine {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2600)
  private timer = new THREE.Timer()
  private character = createCharacter()
  private world = createWorld()
  private inputs = new Set<GameInput>()
  private yaw = 3.42
  private pitch = 0.08
  private draggingCamera = false
  private lastPointer = new THREE.Vector2()
  private verticalVelocity = 0
  private grounded = true
  private activeCar: THREE.Group | null = null
  private vehicleSpeed = 0
  private animationFrame = 0
  private elapsed = 0
  private lastSnapshot = 0
  private lastAutosave = 0
  private stamina = 100
  private missionComplete = false
  private paused = false
  private inWater = false
  private wasInWater = false
  private afloat = false
  private onSeabed = false
  private announcedSwim = false
  private warnedSinkingCar = false
  private carObstacles: Collider[] = []
  private missionMarker = new THREE.Group()
  private sun = new THREE.DirectionalLight('#fff1d2', 2.2)
  private hemi = new THREE.HemisphereLight('#9fd7ff', '#31532a', 1.35)
  private resizeObserver: ResizeObserver
  private onSnapshot: (snapshot: GameSnapshot) => void
  private onMessage: (message: string) => void
  private onMap: (state: MapState) => void
  private core: CoreLoop

  constructor(
    canvas: HTMLCanvasElement,
    onSnapshot: (snapshot: GameSnapshot) => void,
    onMessage: (message: string) => void,
    onMap: (state: MapState) => void,
  ) {
    this.canvas = canvas
    this.onSnapshot = onSnapshot
    this.onMessage = onMessage
    this.onMap = onMap
    this.core = new CoreLoop(this.scene, this.world.colliders, onMessage)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1))
    this.renderer.shadowMap.enabled = false
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene.background = new THREE.Color('#7ec4df')
    this.scene.fog = new THREE.FogExp2('#9bc4c7', 0.00115)
    this.scene.add(this.hemi, this.sun, this.world.group, this.character)
    const spawn = LUGARES.spawn
    this.character.position.set(spawn.x, terrainHeight(spawn.x, spawn.z), spawn.z)
    this.restoreGame()
    this.configureLights()
    this.createMissionMarker()

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    canvas.addEventListener('dblclick', this.requestPointerLock)
    canvas.addEventListener('pointerdown', this.startCameraDrag)
    window.addEventListener('pointerup', this.stopCameraDrag)
    window.addEventListener('pointermove', this.handlePointerMove)
    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(canvas)
    this.timer.connect(document)
    this.resize()
    this.animate()
  }

  private configureLights() {
    this.sun.position.set(-240, 420, 180)
    this.sun.castShadow = false
    this.sun.shadow.camera.left = -420
    this.sun.shadow.camera.right = 420
    this.sun.shadow.camera.top = 420
    this.sun.shadow.camera.bottom = -420
    this.sun.shadow.camera.near = 10
    this.sun.shadow.camera.far = 900
    this.sun.shadow.bias = -0.0003
  }

  private createMissionMarker() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8, 0.7, 12, 36),
      new THREE.MeshBasicMaterial({ color: '#f3d13b', transparent: true, opacity: 0.86 }),
    )
    ring.rotation.x = Math.PI / 2
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 45, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#edc91c',
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      }),
    )
    beam.position.y = 22
    this.missionMarker.add(ring, beam)
    this.missionMarker.position.set(-205, 7, -205)
    this.scene.add(this.missionMarker)
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const input = keys[event.code]
    if (input) {
      event.preventDefault()
      this.inputs.add(input)
    }
    if (event.code === 'KeyF') this.toggleVehicle()
    if (event.code === 'KeyE') this.interact()
    if (event.code === 'KeyB') this.core.toggleBuild()
    if (event.code === 'KeyN') this.core.tryStartNight()
    if (event.code === 'KeyQ') this.attack()
    if (event.code === 'KeyR') this.core.rotate()
    if (event.code === 'Digit1') this.core.select('wall')
    if (event.code === 'Digit2') this.core.select('floor')
    if (event.code === 'Digit3') this.core.select('ramp')
    if (event.code === 'Escape') this.core.shopOpen = false
  }

  private handleKeyUp = (event: KeyboardEvent) => {
    const input = keys[event.code]
    if (input) this.inputs.delete(input)
  }

  private requestPointerLock = () => {
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock().catch(() => undefined)
  }

  private startCameraDrag = (event: PointerEvent) => {
    this.canvas.focus({ preventScroll: true })
    this.draggingCamera = true
    this.lastPointer.set(event.clientX, event.clientY)
    this.canvas.setPointerCapture?.(event.pointerId)
  }

  private stopCameraDrag = () => {
    this.draggingCamera = false
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (document.pointerLockElement !== this.canvas && !this.draggingCamera) return
    const deltaX = document.pointerLockElement === this.canvas ? event.movementX : event.clientX - this.lastPointer.x
    const deltaY = document.pointerLockElement === this.canvas ? event.movementY : event.clientY - this.lastPointer.y
    this.lastPointer.set(event.clientX, event.clientY)
    this.yaw -= deltaX * 0.004
    this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * 0.003, -0.12, 0.82)
  }

  private resize = () => {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  setInput(input: GameInput, pressed: boolean) {
    if (this.paused) return
    if (pressed) this.inputs.add(input)
    else this.inputs.delete(input)
  }

  setPaused(paused: boolean) {
    this.paused = paused
    this.inputs.clear()
  }

  private restoreGame() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '') as SavedGame
      if (
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y) &&
        Number.isFinite(saved.z) &&
        Math.abs(saved.x) <= WORLD_SIZE / 2 &&
        Math.abs(saved.z) <= WORLD_SIZE / 2
      ) {
        this.character.position.set(saved.x, saved.y, saved.z)
        this.yaw = Number.isFinite(saved.yaw) ? saved.yaw : this.yaw
        this.missionComplete = Boolean(saved.missionComplete)
        this.missionMarker.visible = !this.missionComplete
        if (saved.loop) this.core.restore(saved.loop)
      }
    } catch {
      // A missing or invalid save starts a fresh game.
    }
  }

  saveGame = () => {
    const actor = this.activeCar ?? this.character
    const save: SavedGame = {
      x: actor.position.x,
      y: Math.max(terrainHeight(actor.position.x, actor.position.z), actor.position.y),
      z: actor.position.z,
      yaw: this.yaw,
      missionComplete: this.missionComplete,
      loop: this.core.serialize(),
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  }

  toggleVehicle = () => {
    if (this.activeCar) {
      const car = this.activeCar
      this.activeCar = null
      this.character.visible = true
      const side = new THREE.Vector3(6, 0, 0).applyQuaternion(car.quaternion)
      this.character.position.copy(car.position).add(side)
      const terrain = terrainHeight(this.character.position.x, this.character.position.z)
      this.character.position.y = Math.max(terrain, car.position.y)
      this.verticalVelocity = 0
      this.grounded = false
      this.onMessage('Bajaste del vehículo')
      return
    }
    let nearest: THREE.Group | null = null
    let nearestDistance = 13
    for (const car of this.world.cars) {
      const distance = car.position.distanceTo(this.character.position)
      if (distance < nearestDistance) {
        nearest = car
        nearestDistance = distance
      }
    }
    if (nearest) {
      this.activeCar = nearest
      this.character.visible = false
      this.vehicleSpeed = 0
      this.yaw = nearest.rotation.y
      this.onMessage('Vehículo encendido · W/S acelerar · flechas para doblar · F para bajar')
    } else {
      this.onMessage('Acércate a un vehículo para conducirlo')
    }
  }

  interact = () => {
    const actor = this.activeCar ?? this.character
    if (!this.activeCar && this.core.tryInteract(this.character.position)) {
      if (this.core.pendingVehicle) {
        this.core.pendingVehicle = false
        this.spawnPurchasedVehicle()
      }
      return
    }
    const nearby = this.world.interactables.find((item) => item.position.distanceTo(actor.position) < 22)
    if (nearby) {
      this.onMessage(nearby.userData.interaction)
      if (this.activeCar && nearby.userData.interaction.includes('reparado')) this.vehicleSpeed = 0
    } else {
      this.onMessage('No hay nada con qué interactuar aquí')
    }
  }

  private fillCarObstacles(ignore?: THREE.Object3D | null) {
    this.carObstacles.length = 0
    for (const car of this.world.cars) {
      if (car === ignore) continue
      this.carObstacles.push(carCollider(car))
    }
  }

  private resolvePoint(x: number, z: number, radius: number, ignore?: THREE.Object3D | null) {
    this.fillCarObstacles(ignore)
    return separateFromColliders(x, z, radius, this.world.colliders, this.carObstacles)
  }

  private moveWithCollisions(
    position: THREE.Vector3,
    deltaX: number,
    deltaZ: number,
    radius: number,
    ignore?: THREE.Object3D | null,
  ) {
    const alongX = this.resolvePoint(position.x + deltaX, position.z, radius, ignore)
    const resolved = this.resolvePoint(alongX.x, alongX.z + deltaZ, radius, ignore)
    position.x = resolved.x
    position.z = resolved.z
  }

  private updateCharacter(delta: number) {
    if (this.activeCar) {
      this.inWater = false
      this.wasInWater = false
      this.afloat = false
      this.onSeabed = false
      return
    }
    if (this.core.blocksMovement) return
    const turnInput = (this.inputs.has('left') ? 1 : 0) - (this.inputs.has('right') ? 1 : 0)
    if (turnInput !== 0) this.yaw += turnInput * 2.35 * delta
    this.character.rotation.y = this.yaw

    const forwardInput = (this.inputs.has('forward') ? 1 : 0) - (this.inputs.has('backward') ? 0.68 : 0)
    const moving = forwardInput !== 0
    const terrainBeforeMove = terrainHeight(this.character.position.x, this.character.position.z)
    const surfaceBeforeMove = waterSurfaceAt(this.character.position.x, this.character.position.z, terrainBeforeMove)
    const depthBeforeMove = surfaceBeforeMove === null ? 0 : Math.max(0, surfaceBeforeMove - terrainBeforeMove)
    const swimmingBeforeMove =
      surfaceBeforeMove !== null && depthBeforeMove > 1.15 && this.character.position.y < surfaceBeforeMove - 0.2
    const sprinting = moving && this.inputs.has('sprint') && this.stamina > 3
    const speed = (sprinting ? 24 : 14) * (swimmingBeforeMove ? 0.62 : depthBeforeMove > 0.35 ? 0.8 : 1)
    if (sprinting) this.stamina = Math.max(0, this.stamina - delta * 22)
    else this.stamina = Math.min(100, this.stamina + delta * 10)

    if (moving) {
      this.moveWithCollisions(
        this.character.position,
        Math.sin(this.yaw) * forwardInput * speed * delta,
        Math.cos(this.yaw) * forwardInput * speed * delta,
        PLAYER_RADIUS,
      )
    } else {
      this.moveWithCollisions(this.character.position, 0, 0, PLAYER_RADIUS)
    }

    const terrain = terrainHeight(this.character.position.x, this.character.position.z)
    const walk = Math.max(terrain, this.core.structureHeight(this.character.position.x, this.character.position.z))
    const surface = waterSurfaceAt(this.character.position.x, this.character.position.z, terrain)
    const depth = surface === null ? 0 : Math.max(0, surface - terrain)
    const swimming = surface !== null && depth > 1.15 && this.character.position.y < surface - 0.2
    this.inWater = swimming

    if (swimming && surface !== null) {
      if (!this.wasInWater && depth < 2.4 && this.character.position.y <= terrain + 0.35) {
        this.character.position.y = surface - 0.85
        this.verticalVelocity = -1.2
        this.grounded = false
      }
      if (!this.announcedSwim) {
        this.onMessage('Estás en el agua · mantén ESPACIO para nadar hacia arriba y flotar · si lo sueltas, te hundes')
        this.announcedSwim = true
      }
      const swimmingUp = this.inputs.has('jump')
      const targetVelocity = swimmingUp ? 4.2 : -2.6
      this.verticalVelocity = THREE.MathUtils.damp(this.verticalVelocity, targetVelocity, 6, delta)
      this.character.position.y += this.verticalVelocity * delta
      if (this.character.position.y <= terrain) {
        this.character.position.y = terrain
        this.verticalVelocity = 0
        this.grounded = true
      } else {
        this.grounded = false
      }
      const floatY = surface - 3.85
      if (swimmingUp && this.character.position.y >= floatY) {
        this.character.position.y = floatY + Math.sin(this.elapsed * 2.2) * 0.08
        this.verticalVelocity = 0
        this.afloat = true
      } else {
        this.afloat = false
      }
      this.onSeabed = this.grounded
      if (swimmingUp) this.stamina = Math.max(0, this.stamina - delta * 6)
    } else {
      this.afloat = false
      this.onSeabed = false
      if (this.inputs.has('jump') && this.grounded) {
        this.verticalVelocity = 13
        this.grounded = false
        this.inputs.delete('jump')
      }
      this.verticalVelocity -= 31 * delta
      this.character.position.y += this.verticalVelocity * delta
      if (surface !== null && depth > 1.15 && this.character.position.y < surface - 0.2 && this.character.position.y > terrain) {
        this.verticalVelocity *= 0.35
        this.inWater = true
        this.grounded = false
      } else if (this.character.position.y <= walk) {
        this.character.position.y = walk
        this.verticalVelocity = 0
        this.grounded = true
      }
    }
    this.wasInWater = this.inWater

    this.character.position.x = THREE.MathUtils.clamp(this.character.position.x, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    this.character.position.z = THREE.MathUtils.clamp(this.character.position.z, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    const walkCycle = this.elapsed * (sprinting ? 14 : 9)
    const legAmount = this.inWater ? (moving || !this.afloat ? 0.5 : 0.18) : moving && this.grounded ? 0.62 : 0
    const leftLeg = this.character.getObjectByName('leftLeg')
    const rightLeg = this.character.getObjectByName('rightLeg')
    const leftArm = this.character.getObjectByName('leftArm')
    const rightArm = this.character.getObjectByName('rightArm')
    if (leftLeg && rightLeg && leftArm && rightArm) {
      leftLeg.rotation.x = Math.sin(walkCycle) * legAmount
      rightLeg.rotation.x = -Math.sin(walkCycle) * legAmount
      leftArm.rotation.x = -Math.sin(walkCycle) * legAmount * 0.85
      rightArm.rotation.x = Math.sin(walkCycle) * legAmount * 0.85
    }
  }

  private updateVehicle(delta: number) {
    if (!this.activeCar) return
    const accelerating = this.inputs.has('forward')
    const reversing = this.inputs.has('backward')
    if (accelerating) this.vehicleSpeed += 25 * delta
    else if (reversing) this.vehicleSpeed -= 19 * delta
    else this.vehicleSpeed *= Math.pow(0.2, delta)
    this.vehicleSpeed = THREE.MathUtils.clamp(this.vehicleSpeed, -18, this.inputs.has('sprint') ? 58 : 42)
    const turnFactor = THREE.MathUtils.clamp(Math.abs(this.vehicleSpeed) / 9, 0.25, 1.5)
    if (this.inputs.has('left')) {
      this.activeCar.rotation.y += delta * 1.25 * turnFactor * Math.sign(this.vehicleSpeed || 1)
      this.yaw = this.activeCar.rotation.y
    }
    if (this.inputs.has('right')) {
      this.activeCar.rotation.y -= delta * 1.25 * turnFactor * Math.sign(this.vehicleSpeed || 1)
      this.yaw = this.activeCar.rotation.y
    }
    const previousX = this.activeCar.position.x
    const previousZ = this.activeCar.position.z
    this.activeCar.translateZ(this.vehicleSpeed * delta)
    const deltaX = this.activeCar.position.x - previousX
    const deltaZ = this.activeCar.position.z - previousZ
    this.activeCar.position.x = previousX
    this.activeCar.position.z = previousZ
    this.moveWithCollisions(this.activeCar.position, deltaX, deltaZ, VEHICLE_RADIUS, this.activeCar)
    const blocked = Math.hypot(
      previousX + deltaX - this.activeCar.position.x,
      previousZ + deltaZ - this.activeCar.position.z,
    )
    if (blocked > 0.04) this.vehicleSpeed *= blocked > 0.28 ? 0 : 0.32
    this.activeCar.position.x = THREE.MathUtils.clamp(this.activeCar.position.x, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    this.activeCar.position.z = THREE.MathUtils.clamp(this.activeCar.position.z, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    const terrain = terrainHeight(this.activeCar.position.x, this.activeCar.position.z)
    const surface = waterSurfaceAt(this.activeCar.position.x, this.activeCar.position.z, terrain)
    const depth = surface === null ? 0 : surface - terrain
    if (depth > 1.2) {
      this.activeCar.position.y = THREE.MathUtils.damp(this.activeCar.position.y, terrain + 0.45, 1.4, delta)
      this.vehicleSpeed *= Math.pow(0.22, delta)
      if (!this.warnedSinkingCar) {
        this.onMessage('El vehículo se hunde')
        this.warnedSinkingCar = true
      }
    } else {
      this.activeCar.position.y = terrain + 0.4
      this.warnedSinkingCar = false
    }
    for (const wheel of this.activeCar.children.filter((child) => child.name === 'wheel')) {
      wheel.rotation.x += this.vehicleSpeed * delta * 0.45
    }
  }

  private updateCamera(delta: number) {
    const target = this.activeCar ?? this.character
    const distance = this.activeCar ? 17 : 10
    const height = this.activeCar ? 7 : 4.5
    const targetPoint = target.position.clone().add(new THREE.Vector3(0, height, 0))
    const offset = new THREE.Vector3(
      -Math.sin(this.yaw) * distance * Math.cos(this.pitch),
      distance * Math.sin(this.pitch) + 2,
      -Math.cos(this.yaw) * distance * Math.cos(this.pitch),
    )
    const desired = targetPoint.clone().add(offset)
    const groundAtCamera = terrainHeight(desired.x, desired.z) + 1.5
    desired.y = Math.max(desired.y, groundAtCamera)
    let cameraX = targetPoint.x
    let cameraY = targetPoint.y
    let cameraZ = targetPoint.z
    for (let step = 1; step <= 10; step++) {
      const t = step / 10
      const sampleX = targetPoint.x + (desired.x - targetPoint.x) * t
      const sampleZ = targetPoint.z + (desired.z - targetPoint.z) * t
      const sampleY = targetPoint.y + (desired.y - targetPoint.y) * t
      const resolved = this.resolvePoint(sampleX, sampleZ, 0.9, this.activeCar)
      if (Math.hypot(resolved.x - sampleX, resolved.z - sampleZ) > 0.08) break
      cameraX = sampleX
      cameraY = sampleY
      cameraZ = sampleZ
    }
    this.camera.position.lerp(new THREE.Vector3(cameraX, cameraY, cameraZ), 1 - Math.pow(0.002, delta))
    this.camera.lookAt(targetPoint)
    this.sun.position.set(target.position.x - 240, target.position.y + 420, target.position.z + 180)
    this.sun.target.position.copy(target.position)
  }

  private updateEnvironment() {
    const daylight = this.core.phase === 'night' ? 0.14 : 0.86
    this.sun.intensity = daylight * 2.4
    this.hemi.intensity = daylight * 1.45
    const dayColor = new THREE.Color('#7ec4df')
    const duskColor = new THREE.Color('#df8b68')
    const nightColor = new THREE.Color('#0b1830')
    const sky = daylight < 0.35 ? nightColor.clone().lerp(duskColor, daylight / 0.35) : duskColor.clone().lerp(dayColor, (daylight - 0.35) / 0.65)
    this.scene.background = sky
    if (this.scene.fog) this.scene.fog.color.copy(sky)
    const cameraSurface = waterSurfaceAt(this.camera.position.x, this.camera.position.z)
    const underwater = cameraSurface !== null && this.camera.position.y < cameraSurface - 0.15
    this.world.water.forEach((water, index) => {
      const surface = Number(water.userData.surface)
      water.position.y = surface + Math.sin(this.elapsed * 1.4 + index) * 0.07
    })
    if (this.scene.fog instanceof THREE.FogExp2) {
      if (underwater && cameraSurface !== null) {
        const underwaterColor = new THREE.Color('#063646')
        this.scene.background = underwaterColor
        this.scene.fog.color.copy(underwaterColor)
        this.scene.fog.density = 0.045
      } else {
        this.scene.fog.density = 0.00115
      }
    }
    this.missionMarker.rotation.y += 0.01
    const pulse = 1 + Math.sin(this.elapsed * 3) * 0.08
    this.missionMarker.scale.setScalar(pulse)
  }

  private updateMission() {
    const goal = this.core.goalPoint()
    if (!goal) {
      this.missionMarker.visible = false
      return
    }
    this.missionMarker.visible = true
    this.missionMarker.position.set(goal.x, terrainHeight(goal.x, goal.z) + 1, goal.z)
  }

  private emitSnapshot() {
    if (this.elapsed - this.lastSnapshot < 0.28) return
    this.lastSnapshot = this.elapsed
    const actor = this.activeCar ?? this.character
    const nearbyCar = !this.activeCar && this.world.cars.some((car) => car.position.distanceTo(actor.position) < 13)
    const nearbyPlace = this.world.interactables.some((place) => place.position.distanceTo(actor.position) < 22)
    const objective = this.core.goal()
    const remaining = Math.max(0, (this.core.phase === 'day' ? this.core.dayLength() : this.core.nightLength()) - this.core.phaseTime)
    const minutes = Math.floor(remaining / 60).toString().padStart(2, '0')
    const seconds = Math.floor(remaining % 60).toString().padStart(2, '0')
    this.onSnapshot({
      speed: this.activeCar ? Math.round(Math.abs(this.vehicleSpeed) * 3.6) : 0,
      district: this.core.planet === 'platus' ? 'Platus' : districtName(actor.position.x, actor.position.z),
      time: `${this.core.phase === 'day' ? 'DÍA' : 'NOCHE'} ${minutes}:${seconds}`,
      health: Math.round(this.core.health),
      stamina: Math.round(this.stamina),
      money: Math.floor(this.core.money),
      inVehicle: Boolean(this.activeCar),
      nearbyAction: nearbyCar ? 'F · Conducir vehículo' : nearbyPlace ? 'E · Interactuar' : null,
      missionDistance: Math.round(actor.position.distanceTo(this.missionMarker.position)),
      missionComplete: this.core.night > 0 && this.core.phase === 'day',
      swimming: this.inWater,
      afloat: this.afloat,
      onSeabed: this.onSeabed,
      phase: this.core.phase,
      phaseLabel: this.core.phase === 'night' ? `NOCHE ${this.core.night}` : 'DÍA',
      objectiveTitle: objective.title,
      objectiveText: objective.text,
      objectiveHint: objective.hint,
      shopOpen: this.core.shopOpen,
      buildMode: this.core.buildMode,
      buildKind: this.core.buildKind,
      inventory: { ...this.core.inventory },
      shopItems: this.core.shopItems(),
    })
  }

  private emitMap() {
    const actor = this.activeCar ?? this.character
    this.onMap({
      x: actor.position.x,
      z: actor.position.z,
      yaw: this.yaw,
      missionX: this.missionMarker.position.x,
      missionZ: this.missionMarker.position.z,
      missionVisible: this.missionMarker.visible,
    })
  }

  private animate = (timestamp?: number) => {
    this.timer.update(timestamp)
    const delta = Math.min(this.timer.getDelta(), 0.1)
    this.elapsed += delta
    if (!this.paused) {
      this.updateCharacter(delta)
      this.updateVehicle(delta)
      this.core.tick(delta, this.activeCar?.position ?? this.character.position, this.yaw)
      if (this.core.respawn) {
        this.core.respawn = false
        const spawn = this.core.travelAnchor('tierra')
        this.character.position.copy(spawn)
        this.activeCar = null
        this.character.visible = true
      }
      this.updateCamera(delta)
      this.updateEnvironment()
      this.updateMission()
      this.emitSnapshot()
    }
    this.emitMap()
    if (!this.paused) {
      if (this.elapsed - this.lastAutosave > 2) {
        this.lastAutosave = this.elapsed
        this.saveGame()
      }
    }
    this.renderer.render(this.scene, this.camera)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  attack = () => {
    this.core.attack(this.character.position, this.yaw)
  }

  buy = (key: string) => {
    this.core.buy(key)
    if (this.core.pendingVehicle) {
      this.core.pendingVehicle = false
      this.spawnPurchasedVehicle()
    }
  }

  closeShop = () => {
    this.core.shopOpen = false
  }

  toggleBuild = () => {
    this.core.toggleBuild()
  }

  setBuild = (kind: BuildKind) => {
    this.core.select(kind)
  }

  private spawnPurchasedVehicle() {
    const car = this.world.cars[0]?.clone()
    if (!car) return
    car.position.set(LUGARES.super.x + 8, terrainHeight(LUGARES.super.x, LUGARES.super.z) + 0.4, LUGARES.super.z + 10)
    this.world.cars.push(car)
    this.scene.add(car)
    this.onMessage('La moto quedó frente al súper · acércate y pulsa F')
  }

  destroy() {
    this.saveGame()
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.canvas.removeEventListener('dblclick', this.requestPointerLock)
    this.canvas.removeEventListener('pointerdown', this.startCameraDrag)
    window.removeEventListener('pointerup', this.stopCameraDrag)
    window.removeEventListener('pointermove', this.handlePointerMove)
    this.resizeObserver.disconnect()
    this.timer.dispose()
    this.renderer.dispose()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
        else object.material.dispose()
      }
    })
  }
}
