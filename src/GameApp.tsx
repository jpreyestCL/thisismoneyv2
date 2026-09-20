import { useEffect, useRef, useState } from 'react'
import { Car, CircleDollarSign, Clock3, Compass, Crosshair, Gauge, MapPin, Menu, Mountain, Play, Volume2, VolumeX } from 'lucide-react'
import './game.css'
import { GameEngine, type GameInput, type GameSnapshot } from './game/GameEngine'

const SESSION_KEY = 'this-is-money-active-session'

const initialSnapshot: GameSnapshot = {
  speed: 0, district: 'Ciudad Nueva Esperanza', time: '08:00', health: 100,
  stamina: 100, money: 1250, inVehicle: false, nearbyAction: null,
  missionDistance: 290, missionComplete: false,
}

function ControlButton({ input, label, onInput }: {
  input: GameInput
  label: string
  onInput: (input: GameInput, pressed: boolean) => void
}) {
  return (
    <button
      className={`touch-key touch-${input}`}
      onPointerDown={(event) => { event.preventDefault(); onInput(input, true) }}
      onPointerUp={() => onInput(input, false)}
      onPointerCancel={() => onInput(input, false)}
      onPointerLeave={() => onInput(input, false)}
      onClick={() => {
        onInput(input, true)
        window.setTimeout(() => onInput(input, false), input === 'jump' ? 80 : 240)
      }}
      aria-label={label}
    >{label}</button>
  )
}

export default function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const [phase, setPhase] = useState<'menu' | 'loading' | 'playing' | 'error'>(() =>
    localStorage.getItem(SESSION_KEY) === 'true' ? 'playing' : 'menu',
  )
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [message, setMessage] = useState('')
  const [muted, setMuted] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current) return
    try {
      const engine = new GameEngine(canvasRef.current, setSnapshot, (nextMessage) => {
        setMessage(nextMessage)
        window.setTimeout(() => setMessage(''), 4300)
      })
      engineRef.current = engine
      return () => { engine.destroy(); engineRef.current = null }
    } catch (error) {
      console.error(error)
      window.setTimeout(() => setPhase('error'), 0)
    }
  }, [phase])

  useEffect(() => {
    engineRef.current?.setPaused(paused)
  }, [paused])

  const startGame = () => {
    localStorage.setItem(SESSION_KEY, 'true')
    setPhase('loading')
    window.setTimeout(() => setPhase('playing'), 850)
  }

  const saveAndExit = () => {
    engineRef.current?.saveGame()
    localStorage.setItem(SESSION_KEY, 'false')
    setPaused(false)
    setPhase('menu')
  }
  const setInput = (input: GameInput, pressed: boolean) => engineRef.current?.setInput(input, pressed)

  if (phase === 'menu' || phase === 'loading') {
    return (
      <main className="landing">
        <div className="landing-sky" />
        <div className="landing-sun" />
        <div className="mountain mountain-back" />
        <div className="mountain mountain-front" />
        <div className="city-silhouette" />
        <header className="landing-header">
          <div className="brand"><span>THIS IS</span><strong>MONEY</strong></div>
          <span className="build">PRE-ALPHA · BUILD 0.2.0</span>
        </header>
        <section className="hero-copy">
          <p className="eyebrow"><Mountain size={15} /> NUEVA ESPERANZA TE ESPERA</p>
          <h1>Tu ciudad.<br /><em>Tus reglas.</em></h1>
          <p className="intro">Recorre un mundo abierto entre la costa y la cordillera. Explora, conduce y construye tu historia desde cero.</p>
          <button className="play-button" onClick={startGame} disabled={phase === 'loading'}>
            {phase === 'loading' ? <span className="spinner" /> : <Play fill="currentColor" size={20} />}
            {phase === 'loading' ? 'GENERANDO MUNDO…' : 'ENTRAR A LA CIUDAD'}
          </button>
          <div className="world-stats">
            <span><strong>1.96</strong> km² de mundo</span>
            <span><strong>5</strong> vehículos</span>
            <span><strong>11</strong> regiones</span>
          </div>
        </section>
        <div className="menu-hint">VERSIÓN DE DESARROLLO · EL MUNDO SE GENERA LOCALMENTE</div>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main className="error-screen">
        <Mountain size={46} />
        <h1>No pudimos iniciar el mundo 3D</h1>
        <p>Tu navegador debe tener WebGL habilitado. Actualízalo o desactiva el ahorro de energía.</p>
        <button onClick={() => setPhase('menu')}>Volver al inicio</button>
      </main>
    )
  }

  return (
    <main className="game-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="Mundo abierto 3D de Nueva Esperanza"
        tabIndex={0}
        title="Haz clic para activar los controles; arrastra para girar la cámara"
      />
      <div className="top-hud">
        <div className="game-brand"><span>THIS IS</span><strong>MONEY</strong></div>
        <div className="location-chip"><Compass size={15} /><span>{snapshot.district}</span></div>
        <div className="hud-actions">
          <span><Clock3 size={16} /> {snapshot.time}</span>
          <button onClick={() => setMuted(!muted)} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
          <button aria-label="Pausar y abrir menú" onClick={() => setPaused(true)}><Menu size={19} /></button>
        </div>
      </div>
      {paused && (
        <div className="pause-backdrop" role="dialog" aria-modal="true" aria-label="Partida pausada">
          <div className="pause-panel">
            <span className="pause-eyebrow">PARTIDA PAUSADA</span>
            <h2>Nueva Esperanza</h2>
            <p>Tu ubicación y progreso se guardan automáticamente.</p>
            <button className="continue-button" onClick={() => setPaused(false)}>Continuar partida</button>
            <button className="exit-button" onClick={saveAndExit}>Guardar y salir</button>
          </div>
        </div>
      )}
      <div className="mission-card">
        <div className="mission-icon"><MapPin size={19} /></div>
        <div>
          <span>{snapshot.missionComplete ? 'MISIÓN COMPLETADA' : 'PRIMEROS PASOS'}</span>
          <strong>{snapshot.missionComplete ? 'Punto de encuentro asegurado' : 'Ve al punto de encuentro'}</strong>
          {!snapshot.missionComplete && <small>{snapshot.missionDistance} m de distancia</small>}
        </div>
      </div>
      <div className="crosshair"><Crosshair size={23} /></div>
      {message && <div className="toast">{message}</div>}
      {snapshot.nearbyAction && <div className="interaction">{snapshot.nearbyAction}</div>}
      <div className="player-status">
        <div className="portrait">JP</div>
        <div className="status-bars">
          <div><span>VIDA</span><i className="health-bar" style={{ width: `${snapshot.health}%` }} /></div>
          <div><span>ENERGÍA</span><i className="stamina-bar" style={{ width: `${snapshot.stamina}%` }} /></div>
        </div>
        <div className="cash"><CircleDollarSign size={16} /> ${snapshot.money.toLocaleString('es-CL')}</div>
      </div>
      {snapshot.inVehicle && <div className="speedometer"><Gauge size={24} /><strong>{snapshot.speed}</strong><span>KM/H</span></div>}
      <div className="minimap" aria-label="Minimapa">
        <div className="map-grid" /><div className="map-water" /><div className="map-road road-h" />
        <div className="map-road road-v" /><div className="mission-dot" /><div className="player-arrow" /><span>N</span>
      </div>
      <div className="desktop-help">
        <span><kbd>WASD</kbd> Moverse</span><span><kbd>SHIFT</kbd> Correr / turbo</span>
        <span><kbd>CLIC + ARRASTRAR</kbd> Cámara</span><span><kbd>F</kbd> Vehículo</span><span><kbd>E</kbd> Interactuar</span>
      </div>
      <div className="touch-controls">
        <div className="touch-pad">
          <ControlButton input="forward" label="▲" onInput={setInput} /><ControlButton input="left" label="◀" onInput={setInput} />
          <ControlButton input="backward" label="▼" onInput={setInput} /><ControlButton input="right" label="▶" onInput={setInput} />
        </div>
        <div className="touch-actions">
          <button onClick={() => engineRef.current?.toggleVehicle()}><Car size={21} /><span>VEHÍCULO</span></button>
          <ControlButton input="jump" label="SALTAR" onInput={setInput} />
        </div>
      </div>
    </main>
  )
}
