import * as THREE from 'three'
import { LUGARES, loteEn, lotePorId, lotesEnVenta } from './cityMap'
import {
  PLATUS,
  PLOT_PRICE,
  SHOP,
  START_MONEY,
  dayDuration,
  enemiesForNight,
  monsterKillReward,
  nightDuration,
  stageFor,
  type BuildKind,
  type ShopItem,
} from './rules'
import { terrainHeight, separateFromColliders, type Collider } from './world'

export interface PieceRecord {
  kind: BuildKind
  x: number
  z: number
  rot: number
}

export interface LoopSave {
  money: number
  totalEarned: number
  health: number
  plotId: string | null
  pieces: PieceRecord[]
  night: number
  weaponDamage: number
  planet: 'tierra' | 'platus'
}

interface Enemy {
  mesh: THREE.Group
  hp: number
  cooldown: number
}

const CELL = 4

export class CoreLoop {
  money = START_MONEY
  totalEarned = 0
  health = 100
  plotId: string | null = null
  night = 0
  phase: 'day' | 'night' = 'day'
  phaseTime = 0
  weaponDamage = 8
  planet: 'tierra' | 'platus' = 'tierra'
  buildMode = false
  buildKind: BuildKind = 'wall'
  buildRot = 0
  shopOpen = false
  pendingVehicle = false
  respawn = false
  inventory: Record<BuildKind, number> = { wall: 0, floor: 0, ramp: 0 }
  private pieces: { record: PieceRecord; mesh: THREE.Group; base: number }[] = []
  private enemies: Enemy[] = []
  private spawnTimer = 0
  private spawned = 0
  private attackCooldown = 0
  private enemyAttack = 0
  private earthPosition = new THREE.Vector3()
  private ghost = new THREE.Group()
  readonly builds = new THREE.Group()
  private scene: THREE.Scene
  private colliders: Collider[]
  private onMessage: (message: string) => void

  constructor(scene: THREE.Scene, colliders: Collider[], onMessage: (message: string) => void) {
    this.scene = scene
    this.colliders = colliders
    this.onMessage = onMessage
    this.scene.add(this.builds, this.ghost)
    this.ghost.add(this.makePiece('wall', 0x8d6a45))
  }

  get blocksMovement() {
    return this.shopOpen
  }

  dayLength() {
    return dayDuration(this.night)
  }

  nightLength() {
    return nightDuration(Math.max(1, this.night))
  }

  structureHeight(x: number, z: number) {
    let height = Number.NEGATIVE_INFINITY
    for (const piece of this.pieces) {
      const local = this.toLocal(x, z, piece.record)
      if (Math.abs(local.x) > CELL / 2 || Math.abs(local.z) > CELL / 2) continue
      if (piece.record.kind === 'floor') height = Math.max(height, piece.base + 0.28)
      if (piece.record.kind === 'ramp') {
        const along = THREE.MathUtils.clamp((local.x + CELL / 2) / CELL, 0, 1)
        height = Math.max(height, piece.base + along * 3)
      }
    }
    return height
  }

  tick(delta: number, actor: THREE.Vector3, yaw: number) {
    this.phaseTime += delta
    this.attackCooldown = Math.max(0, this.attackCooldown - delta)
    if (this.phase === 'day' && this.phaseTime >= this.dayLength()) this.startNight(false)
    if (this.phase === 'night') {
      this.updateNight(delta, actor)
      if (this.phaseTime >= this.nightLength()) this.startDay()
    }
    this.updateGhost(actor, yaw)
  }

  tryInteract(actor: THREE.Vector3) {
    if (this.shopOpen) {
      this.shopOpen = false
      return true
    }
    if (this.planet === 'platus' && Math.hypot(actor.x - PLATUS.x, actor.z - (PLATUS.z + 16)) < 10) {
      this.travel('tierra', actor)
      return true
    }
    if (this.planet === 'tierra' && Math.hypot(actor.x - LUGARES.aeropuerto.x, actor.z - LUGARES.aeropuerto.z) < 18) {
      this.travel('platus', actor)
      return true
    }
    if (Math.hypot(actor.x - LUGARES.super.x, actor.z - LUGARES.super.z) < 14) {
      this.shopOpen = true
      this.buildMode = false
      this.onMessage('Súper abierto · elige qué comprar')
      return true
    }
    const lot = loteEn(actor.x, actor.z, 1.5)
    if (lot?.venta && this.plotId !== lot.id) {
      this.buyPlot(lot.id)
      return true
    }
    if (this.buildMode) {
      this.place(actor)
      return true
    }
    return false
  }

  buy(key: string) {
    const item = SHOP.find((entry) => entry.key === key)
    if (!item) return
    if (item.unlockAt && this.totalEarned < item.unlockAt) {
      this.onMessage(`${item.name} se desbloquea al ganar $${item.unlockAt} en total`)
      return
    }
    if (this.money < item.price) {
      this.onMessage('Te falta plata')
      return
    }
    this.money -= item.price
    if (item.build) {
      this.inventory[item.build] += 1
      this.onMessage(`${item.name} en la mochila · B para construir`)
    } else if (item.heal) {
      this.health = Math.min(100, this.health + item.heal)
      this.onMessage(`Comiste · vida ${Math.round(this.health)}`)
    } else if (item.damage) {
      this.weaponDamage = Math.max(this.weaponDamage, item.damage)
      this.onMessage(`${item.name} equipada · ${this.weaponDamage} de daño`)
    } else if (item.vehicle) {
      this.pendingVehicle = true
      this.onMessage('Moto lista junto al súper')
    }
  }

  toggleBuild() {
    if (this.shopOpen) return
    this.buildMode = !this.buildMode
    this.onMessage(this.buildMode ? 'Construcción · 1 muro · 2 piso · 3 rampa · R gira · E coloca' : 'Saliste de construcción')
  }

  select(kind: BuildKind) {
    this.buildKind = kind
    this.buildMode = true
    this.refreshGhost()
  }

  rotate() {
    this.buildRot = (this.buildRot + Math.PI / 2) % (Math.PI * 2)
    this.ghost.rotation.y = this.buildRot
  }

  tryStartNight() {
    if (this.phase !== 'day') return
    if (this.wallCount() < 4) {
      this.onMessage('Construye al menos 4 muros en tu terreno')
      return
    }
    if (this.phaseTime < this.dayLength() - 60) this.addMoney(100)
    this.startNight(true)
  }

  attack(actor: THREE.Vector3, yaw: number) {
    if (this.attackCooldown > 0 || this.phase !== 'night') return
    this.attackCooldown = 0.45
    const forwardX = Math.sin(yaw)
    const forwardZ = Math.cos(yaw)
    let best: Enemy | null = null
    let bestDistance = 2.8
    for (const enemy of this.enemies) {
      const dx = enemy.mesh.position.x - actor.x
      const dz = enemy.mesh.position.z - actor.z
      const distance = Math.hypot(dx, dz)
      if (distance < bestDistance && dx * forwardX + dz * forwardZ > 0.2) {
        best = enemy
        bestDistance = distance
      }
    }
    if (!best) return
    best.hp -= this.weaponDamage
    if (best.hp <= 0) this.kill(best)
  }

  damage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.money = Math.floor(this.money * 0.8)
      this.health = 100
      this.clearEnemies()
      this.phase = 'day'
      this.phaseTime = 0
      this.respawn = true
      this.onMessage('Caíste · el penal te soltó con menos plata')
      return true
    }
    return false
  }

  goal() {
    if (!this.plotId) return { title: 'PRIMEROS PASOS', text: 'Compra tu terreno', hint: 'Condominio Los Aromos · $1000' }
    if (this.wallCount() < 4) return { title: 'TU TERRENO', text: 'Levanta 4 muros', hint: `${this.wallCount()}/4 muros · compra en el súper` }
    if (this.phase === 'night') return { title: `NOCHE ${this.night}`, text: 'Defiende la casa', hint: 'Q para golpear' }
    return { title: 'EL DÍA', text: 'Prepárate para la noche', hint: 'N para empezarla antes' }
  }

  goalPoint() {
    if (!this.plotId) {
      const lot = lotesEnVenta()[0]
      return lot ? { x: lot.x, z: lot.z } : null
    }
    if (this.wallCount() < 4) {
      const lot = lotePorId(this.plotId)
      return lot ? { x: lot.x, z: lot.z } : null
    }
    return { x: LUGARES.super.x, z: LUGARES.super.z }
  }

  shopItems() {
    return SHOP.map((item) => ({
      ...item,
      locked: Boolean(item.unlockAt && this.totalEarned < item.unlockAt),
    }))
  }

  serialize(): LoopSave {
    return {
      money: this.money,
      totalEarned: this.totalEarned,
      health: this.health,
      plotId: this.plotId,
      pieces: this.pieces.map((piece) => piece.record),
      night: this.night,
      weaponDamage: this.weaponDamage,
      planet: this.planet,
    }
  }

  restore(save: Partial<LoopSave>) {
    if (Number.isFinite(save.money)) this.money = save.money as number
    if (Number.isFinite(save.totalEarned)) this.totalEarned = save.totalEarned as number
    if (Number.isFinite(save.health)) this.health = save.health as number
    if (Number.isFinite(save.weaponDamage)) this.weaponDamage = save.weaponDamage as number
    if (Number.isFinite(save.night)) this.night = save.night as number
    this.plotId = save.plotId ?? null
    for (const record of save.pieces ?? []) this.spawnPiece(record)
  }

  travelAnchor(planet: 'tierra' | 'platus') {
    if (planet === 'platus') return new THREE.Vector3(PLATUS.x, terrainHeight(PLATUS.x, PLATUS.z), PLATUS.z)
    return new THREE.Vector3(LUGARES.spawn.x, terrainHeight(LUGARES.spawn.x, LUGARES.spawn.z), LUGARES.spawn.z)
  }

  private travel(next: 'tierra' | 'platus', actor: THREE.Vector3) {
    if (next === 'platus') this.earthPosition.copy(actor)
    this.planet = next
    const destination = next === 'tierra' && this.earthPosition.lengthSq() > 1 ? this.earthPosition : this.travelAnchor(next)
    actor.copy(destination)
    this.onMessage(next === 'platus' ? 'Llegaste a Platus' : 'Volviste a Nueva Esperanza')
  }

  private buyPlot(id: string) {
    if (this.plotId) {
      this.onMessage('Ya tienes un terreno')
      return
    }
    if (this.money < PLOT_PRICE) {
      this.onMessage(`El terreno cuesta $${PLOT_PRICE}`)
      return
    }
    this.money -= PLOT_PRICE
    this.plotId = id
    this.onMessage('Terreno comprado · ve al súper por muros')
  }

  private place(actor: THREE.Vector3) {
    if (!this.plotId) {
      this.onMessage('Primero compra un terreno')
      return
    }
    const lot = lotePorId(this.plotId)
    if (!lot) return
    const snapped = this.snap(actor.x, actor.z, this.buildRot)
    if (Math.abs(snapped.x - lot.x) > lot.w / 2 || Math.abs(snapped.z - lot.z) > lot.d / 2) {
      this.onMessage('Solo puedes construir dentro de tu lote')
      return
    }
    if (this.inventory[this.buildKind] <= 0) {
      this.onMessage('No te quedan piezas · cómpralas en el súper')
      return
    }
    const occupied = this.pieces.some((piece) => piece.record.kind === this.buildKind && Math.hypot(piece.record.x - snapped.x, piece.record.z - snapped.z) < 1.5 && piece.record.rot === this.buildRot)
    if (occupied) return
    this.inventory[this.buildKind] -= 1
    this.spawnPiece({ kind: this.buildKind, x: snapped.x, z: snapped.z, rot: this.buildRot })
  }

  private spawnPiece(record: PieceRecord) {
    const mesh = this.makePiece(record.kind, record.kind === 'wall' ? 0xc4a574 : record.kind === 'floor' ? 0xd9d3c7 : 0xb7c0c8)
    const base = terrainHeight(record.x, record.z)
    mesh.position.set(record.x, base, record.z)
    mesh.rotation.y = record.rot
    this.builds.add(mesh)
    this.pieces.push({ record, mesh, base })
    if (record.kind === 'wall') {
      const wide = Math.abs(Math.cos(record.rot)) > 0.5
      this.colliders.push({
        kind: 'box',
        x: record.x,
        z: record.z,
        halfWidth: wide ? CELL / 2 : 0.2,
        halfDepth: wide ? 0.2 : CELL / 2,
        rotation: 0,
      })
    }
  }

  private makePiece(kind: BuildKind, color: number) {
    const group = new THREE.Group()
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
    if (kind === 'wall') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(CELL, 3, 0.22), material)
      frame.position.y = 1.5
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(CELL - 0.55, 2.35, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xe7d3b0, roughness: 0.7 }),
      )
      panel.position.y = 1.55
      group.add(frame, panel)
    } else if (kind === 'floor') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.22, CELL), material)
      slab.position.y = 0.11
      group.add(slab)
    } else {
      const shape = new THREE.Shape()
      shape.moveTo(-CELL / 2, 0)
      shape.lineTo(CELL / 2, 0)
      shape.lineTo(CELL / 2, 3)
      const ramp = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: CELL, bevelEnabled: false }),
        material,
      )
      ramp.geometry.translate(0, 0, -CELL / 2)
      ramp.geometry.rotateY(Math.PI / 2)
      group.add(ramp)
    }
    return group
  }

  private refreshGhost() {
    this.ghost.clear()
    const preview = this.makePiece(this.buildKind, 0xf1cc3a)
    preview.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial
        material.transparent = true
        material.opacity = 0.45
      }
    })
    this.ghost.add(preview)
  }

  private updateGhost(actor: THREE.Vector3, yaw: number) {
    this.ghost.visible = this.buildMode && !this.shopOpen
    if (!this.ghost.visible) return
    const snapped = this.snap(actor.x + Math.sin(yaw) * 3, actor.z + Math.cos(yaw) * 3, this.buildRot)
    this.ghost.position.set(snapped.x, terrainHeight(snapped.x, snapped.z), snapped.z)
    this.ghost.rotation.y = this.buildRot
  }

  private snap(x: number, z: number, _rot: number) {
    return {
      x: Math.round(x / CELL) * CELL,
      z: Math.round(z / CELL) * CELL,
    }
  }

  private wallCount() {
    return this.pieces.filter((piece) => piece.record.kind === 'wall').length
  }

  private startNight(early: boolean) {
    this.phase = 'night'
    this.phaseTime = 0
    this.night += 1
    this.spawned = 0
    this.spawnTimer = 0
    this.onMessage(early ? `Noche ${this.night}. Te adelantaste.` : `Noche ${this.night}. Llegan ${enemiesForNight(this.night)} monstruos`)
  }

  private startDay() {
    const bonus = 150 + this.night * 40
    this.addMoney(bonus)
    this.clearEnemies()
    this.phase = 'day'
    this.phaseTime = 0
    this.onMessage(`Amaneció · +$${bonus}`)
  }

  private updateNight(delta: number, actor: THREE.Vector3) {
    const targetCount = enemiesForNight(this.night)
    this.spawnTimer -= delta
    if (this.spawned < targetCount && this.spawnTimer <= 0) {
      this.spawnEnemy(actor)
      this.spawned += 1
      this.spawnTimer = 3.5
    }
    this.enemyAttack -= delta
    for (const enemy of this.enemies) {
      const dx = actor.x - enemy.mesh.position.x
      const dz = actor.z - enemy.mesh.position.z
      const distance = Math.hypot(dx, dz) || 1
      if (distance > 1.7) {
        const step = 3.4 * delta
        const next = separateFromColliders(
          enemy.mesh.position.x + (dx / distance) * step,
          enemy.mesh.position.z + (dz / distance) * step,
          0.7,
          this.colliders,
        )
        enemy.mesh.position.x = next.x
        enemy.mesh.position.z = next.z
        enemy.mesh.position.y = Math.max(terrainHeight(next.x, next.z), this.structureHeight(next.x, next.z))
      }
      enemy.mesh.lookAt(actor.x, enemy.mesh.position.y, actor.z)
      if (distance < 1.9 && this.enemyAttack <= 0) {
        this.enemyAttack = 1.15
        this.damage(10)
      }
    }
  }

  private spawnEnemy(actor: THREE.Vector3) {
    const angle = Math.random() * Math.PI * 2
    const radius = 22 + Math.random() * 10
    const mesh = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.55, 1.1, 4, 8),
      new THREE.MeshStandardMaterial({ color: '#8d4a3a', roughness: 0.8 }),
    )
    body.position.y = 1.35
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#c4896a', roughness: 0.75 }),
    )
    head.position.y = 2.35
    mesh.add(body, head)
    mesh.position.set(actor.x + Math.cos(angle) * radius, terrainHeight(actor.x, actor.z), actor.z + Math.sin(angle) * radius)
    this.scene.add(mesh)
    this.enemies.push({ mesh, hp: 10, cooldown: 0 })
  }

  private kill(enemy: Enemy) {
    const reward = monsterKillReward(stageFor(this.totalEarned))
    this.addMoney(reward)
    this.scene.remove(enemy.mesh)
    this.enemies = this.enemies.filter((entry) => entry !== enemy)
    this.onMessage(`+$${reward}`)
  }

  private clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.mesh)
    this.enemies = []
  }

  private addMoney(amount: number) {
    this.money += amount
    if (amount > 0) this.totalEarned += amount
  }

  private toLocal(x: number, z: number, record: PieceRecord) {
    const dx = x - record.x
    const dz = z - record.z
    const cos = Math.cos(-record.rot)
    const sin = Math.sin(-record.rot)
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos }
  }
}

export type ShopView = ShopItem & { locked: boolean }
