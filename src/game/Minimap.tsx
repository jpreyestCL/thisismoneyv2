import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { MapState } from './GameEngine'
import {
  biomeAt,
  CITY_LIMIT,
  LAKE_SURFACE,
  SEA_LEVEL,
  terrainHeight,
  waterSurfaceAt,
  WORLD_SIZE,
  type Biome,
} from './world'
import { callesDelMapa, DISTRITOS } from './cityMap'

const ATLAS = 220
const VIEW_RANGE = 420

const BIOME_COLOR: Record<Biome, [number, number, number]> = {
  ocean: [8, 104, 128],
  beach: [213, 193, 132],
  plains: [86, 130, 73],
  forest: [55, 99, 58],
  darkForest: [30, 69, 45],
  jungle: [37, 95, 53],
  desert: [168, 137, 79],
  alpine: [96, 112, 104],
  snow: [236, 240, 238],
}

let atlas: HTMLCanvasElement | null = null

function ensureAtlas() {
  if (atlas) return atlas
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS
  canvas.height = ATLAS
  const context = canvas.getContext('2d')
  if (!context) return canvas
  const image = context.createImageData(ATLAS, ATLAS)
  for (let row = 0; row < ATLAS; row++) {
    const z = WORLD_SIZE / 2 - ((row + 0.5) / ATLAS) * WORLD_SIZE
    for (let column = 0; column < ATLAS; column++) {
      const x = -WORLD_SIZE / 2 + ((column + 0.5) / ATLAS) * WORLD_SIZE
      const height = terrainHeight(x, z)
      const surface = waterSurfaceAt(x, z, height)
      let color = BIOME_COLOR[biomeAt(x, z, height)]
      if (Math.abs(x) < CITY_LIMIT && Math.abs(z) < CITY_LIMIT && height > SEA_LEVEL + 1) color = [108, 114, 106]
      if (surface !== null && height < surface - 0.35) {
        color = surface === LAKE_SURFACE ? [22, 126, 142] : [10, 112, 136]
      }
      const offset = (row * ATLAS + column) * 4
      image.data[offset] = color[0]
      image.data[offset + 1] = color[1]
      image.data[offset + 2] = color[2]
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  context.strokeStyle = 'rgba(226, 230, 220, 0.16)'
  context.lineWidth = 1
  for (let line = -WORLD_SIZE / 2; line <= WORLD_SIZE / 2; line += 100) {
    const x = ((line + WORLD_SIZE / 2) / WORLD_SIZE) * ATLAS
    const y = ((WORLD_SIZE / 2 - line) / WORLD_SIZE) * ATLAS
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, ATLAS)
    context.moveTo(0, y)
    context.lineTo(ATLAS, y)
    context.stroke()
  }
  context.strokeStyle = '#24292b'
  context.lineWidth = Math.max(2, (9 / WORLD_SIZE) * ATLAS)
  context.lineCap = 'butt'
  const toX = (x: number) => ((x + WORLD_SIZE / 2) / WORLD_SIZE) * ATLAS
  const toY = (z: number) => ((WORLD_SIZE / 2 - z) / WORLD_SIZE) * ATLAS
  for (const district of DISTRITOS) {
    context.fillStyle = district.tipo === 'hogar' ? '#6d9a58' : district.tipo === 'deporte' ? '#3f7d45' : '#8e948f'
    context.fillRect(toX(district.x - district.w / 2), toY(district.z + district.d / 2), (district.w / WORLD_SIZE) * ATLAS, (district.d / WORLD_SIZE) * ATLAS)
  }
  for (const street of callesDelMapa()) {
    context.beginPath()
    if (street.horizontal) {
      context.moveTo(toX(street.cx - street.len / 2), toY(street.cz))
      context.lineTo(toX(street.cx + street.len / 2), toY(street.cz))
    } else {
      context.moveTo(toX(street.cx), toY(street.cz - street.len / 2))
      context.lineTo(toX(street.cx), toY(street.cz + street.len / 2))
    }
    context.stroke()
  }
  atlas = canvas
  return canvas
}

export type MinimapHandle = {
  draw: (state: MapState) => void
}

export const Minimap = forwardRef<MinimapHandle>(function Minimap(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useImperativeHandle(ref, () => ({
    draw(state: MapState) {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context) return
      const cssSize = canvas.clientWidth || 158
      const resolution = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
      const size = Math.round(cssSize * resolution)
      if (canvas.width !== size) {
        canvas.width = size
        canvas.height = size
      }
      const map = ensureAtlas()
      const scale = ATLAS / WORLD_SIZE
      const sourceSize = VIEW_RANGE * scale
      const sourceX = (state.x + WORLD_SIZE / 2) * scale - sourceSize / 2
      const sourceY = (WORLD_SIZE / 2 - state.z) * scale - sourceSize / 2
      context.clearRect(0, 0, size, size)
      context.fillStyle = '#0a6c84'
      context.fillRect(0, 0, size, size)
      context.drawImage(map, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)

      if (state.missionVisible) {
        let markerX = size / 2 + ((state.missionX - state.x) / VIEW_RANGE) * size
        let markerY = size / 2 - ((state.missionZ - state.z) / VIEW_RANGE) * size
        const offsetX = markerX - size / 2
        const offsetY = markerY - size / 2
        const limit = size * 0.4
        const distance = Math.hypot(offsetX, offsetY)
        if (distance > limit) {
          markerX = size / 2 + (offsetX / distance) * limit
          markerY = size / 2 + (offsetY / distance) * limit
        }
        context.beginPath()
        context.fillStyle = '#f0cc28'
        context.strokeStyle = '#ffffff'
        context.lineWidth = Math.max(1.5, resolution)
        context.arc(markerX, markerY, 4.5 * resolution, 0, Math.PI * 2)
        context.fill()
        context.stroke()
      }

      context.save()
      context.translate(size / 2, size / 2)
      context.rotate(state.yaw)
      context.fillStyle = '#ffffff'
      context.strokeStyle = '#142018'
      context.lineWidth = Math.max(1.5, resolution)
      context.beginPath()
      context.moveTo(0, -9 * resolution)
      context.lineTo(6 * resolution, 7 * resolution)
      context.lineTo(0, 3.5 * resolution)
      context.lineTo(-6 * resolution, 7 * resolution)
      context.closePath()
      context.fill()
      context.stroke()
      context.restore()
    },
  }))

  return (
    <div className="minimap" aria-label="Minimapa">
      <canvas ref={canvasRef} />
      <span>N</span>
    </div>
  )
})
