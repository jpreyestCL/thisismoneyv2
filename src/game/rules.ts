export const START_MONEY = 2000
export const PLOT_PRICE = 1000
export const FIRST_DAY_SECONDS = 300
export const DAY_SECONDS = 270
export const NIGHT_SECONDS = 180
export const FIRST_NIGHT_SECONDS = 90

export const PLATUS = { x: 0, z: 520, radius: 150, height: 22 }
export const TESORO = { x: -520, z: -420, radius: 78, height: 8 }

export type BuildKind = 'wall' | 'floor' | 'ramp'

export interface ShopItem {
  key: string
  name: string
  price: number
  unlockAt?: number
  build?: BuildKind
  heal?: number
  vehicle?: boolean
  damage?: number
}

export const SHOP: ShopItem[] = [
  { key: 'wall', name: 'Muro', price: 60, build: 'wall' },
  { key: 'floor', name: 'Piso', price: 40, build: 'floor' },
  { key: 'ramp', name: 'Rampa', price: 60, build: 'ramp' },
  { key: 'comida', name: 'Comida', price: 100, heal: 45 },
  { key: 'espada', name: 'Espada', price: 400, damage: 16 },
  { key: 'moto', name: 'Moto', price: 3500, unlockAt: 10000, vehicle: true },
]

export function dayDuration(night: number) {
  return night === 0 ? FIRST_DAY_SECONDS : DAY_SECONDS
}

export function nightDuration(night: number) {
  return night <= 1 ? FIRST_NIGHT_SECONDS : NIGHT_SECONDS
}

export function enemiesForNight(night: number) {
  return night <= 1 ? 3 : Math.min(12, 2 * night - 1)
}

export function monsterKillReward(stage: number) {
  return 1 + Math.min(7, Math.floor((Math.max(1, stage) - 1) / 5))
}

export function stageFor(totalEarned: number) {
  return 1 + Math.floor(totalEarned / 1000)
}
