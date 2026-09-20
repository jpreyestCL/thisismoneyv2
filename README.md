# This Is Money

Prototipo jugable de mundo abierto 3D ambientado en **Nueva Esperanza**, una ciudad ficticia entre la costa y la cordillera. Esta primera versión funciona completamente en el navegador y genera el escenario en tiempo real, sin descargar modelos externos.

## Qué incluye la versión 0.2

- Isla procedural de 2,25 km² con costa irregular, bahías, playas y relieve continuo generado por ruido fractal.
- Cordillera formada por varios macizos integrados al terreno, roca alpina y cumbres nevadas.
- Biomas diferenciados: selva húmeda, bosque templado, bosque oscuro, praderas, desierto, costa y alta montaña.
- Más de mil árboles, coníferas, árboles selváticos y cactus renderizados mediante instancias optimizadas.
- Ciudad con calles, edificios con ventanas emisivas, plaza, monumento, alumbrado real y estación de servicio.
- Personaje en tercera persona con movimiento, carrera, salto, energía y cámara libre.
- Cinco vehículos conducibles con aceleración, frenado, dirección y turbo.
- Ciclo dinámico de día y noche, iluminación, sombras, niebla atmosférica y agua.
- Primera misión, lugares interactivos, HUD, minimapa, economía inicial y velocímetro.
- Guardado automático local de posición y progreso; las recargas continúan la sesión activa.
- Menú de pausa con salida explícita mediante **Guardar y salir**.
- Controles adaptados para teclado/ratón y pantallas táctiles.
- Pantallas de inicio, carga y error WebGL.

## Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 43127
```

Luego abre `http://localhost:43127`.

## Controles

| Acción | Teclado |
| --- | --- |
| Moverse / conducir | `W A S D` o flechas |
| Correr / turbo | `Shift` |
| Saltar | `Espacio` |
| Entrar o salir de un vehículo | `F` |
| Interactuar | `E` |
| Girar la cámara | Clic sobre el juego y mover el ratón |

En dispositivos táctiles aparecen controles en pantalla.

## Arquitectura

- `src/game/GameEngine.ts`: bucle principal, cámara, controles, jugador, conducción, misión y ciclo ambiental.
- `src/game/world.ts`: generación procedural del terreno, agua, ciudad, vegetación, edificios y vehículos.
- `src/GameApp.tsx`: flujo de inicio y HUD reactivo.
- `src/game.css`: dirección visual, interfaz y adaptación móvil.

## Próximas etapas sugeridas

1. Colisiones físicas para edificios, vehículos y elementos del escenario.
2. Modelos GLTF/GLB para personaje, vehículos, NPCs y decoración.
3. Animaciones esqueléticas, inventario, combate y sistema de daño.
4. Tráfico, peatones y bots con navegación por malla.
5. Sistema de trabajos, propiedades, tiendas, policía y economía.
6. Persistencia de cuenta, progreso, mundo y multijugador mediante backend.
7. Audio ambiental, efectos, música y optimización por sectores.

El proyecto usa React, TypeScript, Vite y Three.js.
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
