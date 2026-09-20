import * as THREE from 'three'
import { biomeAt, CITY_LIMIT, createWorld, SEA_LEVEL, terrainHeight, WORLD_SIZE } from './world'

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
}

export type GameInput = 'forward' | 'backward' | 'left' | 'right' | 'sprint' | 'jump'

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
  character.add(torso, head, hair, leftLeg, rightLeg)
  character.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  return character
}

function districtName(x: number, z: number) {
  if (Math.hypot(x, z) < 85) return 'Centro Cívico'
  if (Math.abs(x) < CITY_LIMIT && Math.abs(z) < CITY_LIMIT) {
    if (z < -80) return 'Distrito Financiero'
    if (x > 100) return 'Barrio Industrial'
    if (x < -100) return 'Casco Antiguo'
    return 'Ciudad Nueva Esperanza'
  }
  if (Math.hypot(x + 355, z - 285) < 190) return 'Lago Espejo'
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
  private yaw = Math.PI
  private pitch = 0.08
  private draggingCamera = false
  private verticalVelocity = 0
  private grounded = true
  private activeCar: THREE.Group | null = null
  private vehicleSpeed = 0
  private animationFrame = 0
  private elapsed = 0
  private lastSnapshot = 0
  private stamina = 100
  private missionComplete = false
  private missionMarker = new THREE.Group()
  private sun = new THREE.DirectionalLight('#fff1d2', 2.2)
  private hemi = new THREE.HemisphereLight('#9fd7ff', '#31532a', 1.35)
  private resizeObserver: ResizeObserver
  private onSnapshot: (snapshot: GameSnapshot) => void
  private onMessage: (message: string) => void

  constructor(
    canvas: HTMLCanvasElement,
    onSnapshot: (snapshot: GameSnapshot) => void,
    onMessage: (message: string) => void,
  ) {
    this.canvas = canvas
    this.onSnapshot = onSnapshot
    this.onMessage = onMessage
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene.background = new THREE.Color('#7ec4df')
    this.scene.fog = new THREE.FogExp2('#9bc4c7', 0.00115)
    this.scene.add(this.hemi, this.sun, this.world.group, this.character)
    this.character.position.set(28, terrainHeight(28, 58), 58)
    this.configureLights()
    this.createMissionMarker()

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    canvas.addEventListener('click', this.requestPointerLock)
    canvas.addEventListener('pointerdown', this.startCameraDrag)
    window.addEventListener('pointerup', this.stopCameraDrag)
    document.addEventListener('mousemove', this.handleMouseMove)
    this.resizeObserver = new ResizeObserver(this.resize)
    this.resizeObserver.observe(canvas)
    this.timer.connect(document)
    this.resize()
    this.animate()
  }

  private configureLights() {
    this.sun.position.set(-240, 420, 180)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
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
  }

  private handleKeyUp = (event: KeyboardEvent) => {
    const input = keys[event.code]
    if (input) this.inputs.delete(input)
  }

  private requestPointerLock = () => {
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock().catch(() => undefined)
  }

  private startCameraDrag = () => {
    this.draggingCamera = true
  }

  private stopCameraDrag = () => {
    this.draggingCamera = false
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas && !this.draggingCamera) return
    this.yaw -= event.movementX * 0.0024
    this.pitch = THREE.MathUtils.clamp(this.pitch + event.movementY * 0.0018, -0.12, 0.82)
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
    if (pressed) this.inputs.add(input)
    else this.inputs.delete(input)
  }

  toggleVehicle = () => {
    if (this.activeCar) {
      const car = this.activeCar
      this.activeCar = null
      this.character.visible = true
      const side = new THREE.Vector3(6, 0, 0).applyQuaternion(car.quaternion)
      this.character.position.copy(car.position).add(side)
      this.character.position.y = terrainHeight(this.character.position.x, this.character.position.z)
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
      this.onMessage('Vehículo encendido · WASD para conducir · F para bajar')
    } else {
      this.onMessage('Acércate a un vehículo para conducirlo')
    }
  }

  interact = () => {
    const actor = this.activeCar ?? this.character
    const nearby = this.world.interactables.find((item) => item.position.distanceTo(actor.position) < 22)
    if (nearby) {
      this.onMessage(nearby.userData.interaction)
      if (this.activeCar && nearby.userData.interaction.includes('reparado')) this.vehicleSpeed = 0
    } else {
      this.onMessage('No hay nada con qué interactuar aquí')
    }
  }

  private updateCharacter(delta: number) {
    if (this.activeCar) return
    const moving = this.inputs.has('forward') || this.inputs.has('backward')
    const sprinting = moving && this.inputs.has('sprint') && this.stamina > 3
    const speed = sprinting ? 20 : 11
    if (sprinting) this.stamina = Math.max(0, this.stamina - delta * 22)
    else this.stamina = Math.min(100, this.stamina + delta * 13)

    if (this.inputs.has('left')) this.yaw += delta * 1.8
    if (this.inputs.has('right')) this.yaw -= delta * 1.8
    let direction = 0
    if (this.inputs.has('forward')) direction += 1
    if (this.inputs.has('backward')) direction -= 0.65
    if (direction) {
      this.character.rotation.y = this.yaw
      this.character.position.x += Math.sin(this.yaw) * speed * direction * delta
      this.character.position.z += Math.cos(this.yaw) * speed * direction * delta
    }

    if (this.inputs.has('jump') && this.grounded) {
      this.verticalVelocity = 13
      this.grounded = false
      this.inputs.delete('jump')
    }
    this.verticalVelocity -= 31 * delta
    this.character.position.y += this.verticalVelocity * delta
    const ground = Math.max(SEA_LEVEL + 0.2, terrainHeight(this.character.position.x, this.character.position.z))
    if (this.character.position.y <= ground) {
      this.character.position.y = ground
      this.verticalVelocity = 0
      this.grounded = true
    }

    this.character.position.x = THREE.MathUtils.clamp(this.character.position.x, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    this.character.position.z = THREE.MathUtils.clamp(this.character.position.z, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    const walkCycle = this.elapsed * (sprinting ? 14 : 9)
    const legAmount = moving && this.grounded ? 0.62 : 0
    const leftLeg = this.character.getObjectByName('leftLeg')
    const rightLeg = this.character.getObjectByName('rightLeg')
    if (leftLeg && rightLeg) {
      leftLeg.rotation.x = Math.sin(walkCycle) * legAmount
      rightLeg.rotation.x = -Math.sin(walkCycle) * legAmount
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
    if (this.inputs.has('left')) this.activeCar.rotation.y += delta * 1.25 * turnFactor * Math.sign(this.vehicleSpeed || 1)
    if (this.inputs.has('right')) this.activeCar.rotation.y -= delta * 1.25 * turnFactor * Math.sign(this.vehicleSpeed || 1)
    this.activeCar.translateZ(this.vehicleSpeed * delta)
    this.activeCar.position.x = THREE.MathUtils.clamp(this.activeCar.position.x, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    this.activeCar.position.z = THREE.MathUtils.clamp(this.activeCar.position.z, -WORLD_SIZE / 2, WORLD_SIZE / 2)
    this.activeCar.position.y = Math.max(
      SEA_LEVEL + 1,
      terrainHeight(this.activeCar.position.x, this.activeCar.position.z) + 0.4,
    )
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
    this.camera.position.lerp(desired, 1 - Math.pow(0.002, delta))
    this.camera.lookAt(targetPoint)
    this.sun.position.set(target.position.x - 240, target.position.y + 420, target.position.z + 180)
    this.sun.target.position.copy(target.position)
  }

  private updateEnvironment() {
    const dayProgress = (this.elapsed * 0.0025 + 0.2) % 1
    const sunAngle = dayProgress * Math.PI * 2
    const daylight = THREE.MathUtils.clamp(Math.sin(sunAngle) * 0.55 + 0.65, 0.14, 1)
    this.sun.intensity = daylight * 2.4
    this.hemi.intensity = daylight * 1.45
    const dayColor = new THREE.Color('#7ec4df')
    const duskColor = new THREE.Color('#df8b68')
    const nightColor = new THREE.Color('#0b1830')
    const sky = daylight < 0.35 ? nightColor.clone().lerp(duskColor, daylight / 0.35) : duskColor.clone().lerp(dayColor, (daylight - 0.35) / 0.65)
    this.scene.background = sky
    if (this.scene.fog) this.scene.fog.color.copy(sky)
    this.world.water.forEach((water, index) => {
      water.position.y += Math.sin(this.elapsed * 1.4 + index) * 0.0008
    })
    this.missionMarker.rotation.y += 0.01
    const pulse = 1 + Math.sin(this.elapsed * 3) * 0.08
    this.missionMarker.scale.setScalar(pulse)
  }

  private updateMission() {
    if (this.missionComplete) return
    const actor = this.activeCar ?? this.character
    if (actor.position.distanceTo(this.missionMarker.position) < 14) {
      this.missionComplete = true
      this.missionMarker.visible = false
      this.onMessage('MISIÓN COMPLETADA · Llegaste al punto de encuentro · +$2.500')
    }
  }

  private emitSnapshot() {
    if (this.elapsed - this.lastSnapshot < 0.12) return
    this.lastSnapshot = this.elapsed
    const actor = this.activeCar ?? this.character
    const totalMinutes = Math.floor(((this.elapsed * 0.15 + 8) % 24) * 60)
    const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
    const minute = (totalMinutes % 60).toString().padStart(2, '0')
    const nearbyCar = !this.activeCar && this.world.cars.some((car) => car.position.distanceTo(actor.position) < 13)
    const nearbyPlace = this.world.interactables.some((place) => place.position.distanceTo(actor.position) < 22)
    this.onSnapshot({
      speed: this.activeCar ? Math.round(Math.abs(this.vehicleSpeed) * 3.6) : 0,
      district: districtName(actor.position.x, actor.position.z),
      time: `${hour}:${minute}`,
      health: 100,
      stamina: Math.round(this.stamina),
      money: this.missionComplete ? 3750 : 1250,
      inVehicle: Boolean(this.activeCar),
      nearbyAction: nearbyCar ? 'F · Conducir vehículo' : nearbyPlace ? 'E · Interactuar' : null,
      missionDistance: Math.round(actor.position.distanceTo(this.missionMarker.position)),
      missionComplete: this.missionComplete,
    })
  }

  private animate = (timestamp?: number) => {
    this.timer.update(timestamp)
    const delta = Math.min(this.timer.getDelta(), 0.05)
    this.elapsed += delta
    this.updateCharacter(delta)
    this.updateVehicle(delta)
    this.updateCamera(delta)
    this.updateEnvironment()
    this.updateMission()
    this.emitSnapshot()
    this.renderer.render(this.scene, this.camera)
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame)
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.canvas.removeEventListener('click', this.requestPointerLock)
    this.canvas.removeEventListener('pointerdown', this.startCameraDrag)
    window.removeEventListener('pointerup', this.stopCameraDrag)
    document.removeEventListener('mousemove', this.handleMouseMove)
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
