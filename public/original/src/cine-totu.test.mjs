import assert from 'node:assert/strict';
import {
  CINE_FILMS, TOTU, centroSala, tramosSala, cineAlturaEn, puedeEntrar, asientosDeSala, dentroDeTotu,
} from './cine-totu.js';

const sala = 1;
const cx = centroSala(sala);
assert.equal(CINE_FILMS.length, 3);
assert.equal(puedeEntrar(null, 0), false);
assert.equal(puedeEntrar({ sala: 0 }, 1), false);
assert.equal(puedeEntrar({ sala: 1 }, 1), true);

assert.equal(cineAlturaEn(cx, -31.9), 0);
assert.ok(Math.abs(cineAlturaEn(cx, -32.2) - 0) < 0.02);
const medioSubida = cineAlturaEn(cx, -33.35);
assert.ok(medioSubida > 0.45 && medioSubida < 0.75, 'subida a media altura, salió ' + medioSubida);
assert.equal(cineAlturaEn(cx, -35.25), 1.2);
const medioBajada = cineAlturaEn(cx, -37.275);
assert.ok(medioBajada > 0.5 && medioBajada < 0.85, 'bajada a media altura, salió ' + medioBajada);
assert.ok(Math.abs(cineAlturaEn(cx, -40.15) - 0.16) < 0.02);
assert.equal(cineAlturaEn(cx + 3, -33.35), null);
assert.equal(cineAlturaEn(27.5, -16), null);

for (const fila of asientosDeSala(sala)) {
  const y = cineAlturaEn(fila.standX, fila.standZ);
  assert.ok(Math.abs(y - fila.piso) < 0.02, 'el pasillo del asiento no está a la altura de la fila');
  assert.ok(dentroDeTotu(fila.x, fila.z));
}

for (const s of tramosSala(0)) {
  assert.ok(s.minX > TOTU.x0 && s.maxX < TOTU.x1);
  assert.ok(s.minZ > TOTU.zS && s.maxZ < TOTU.zN);
}

let y = 0;
for (let z = -31.9; z >= -42.2; z -= 0.15) {
  const next = cineAlturaEn(cx, z);
  if (next == null) continue;
  assert.ok(Math.abs(next - y) < 0.22, 'el piso pega un salto de ' + Math.abs(next - y) + ' en z=' + z);
  y = next;
}

console.log('cine-totu ok');
