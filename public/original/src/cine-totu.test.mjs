import assert from 'node:assert/strict';
import {
  CINE_FILMS, TOTU, centroSala, tramosSala, cineAlturaEn, puedeEntrar, asientosDeSala, dentroDeTotu, pintarCine,
} from './cine-totu.js';

const sala = 1;
const cx = centroSala(sala);
assert.equal(CINE_FILMS.length, 3);
assert.equal(puedeEntrar(null, 0), false);
assert.equal(puedeEntrar({ sala: 0 }, 1), false);
assert.equal(puedeEntrar({ sala: 1 }, 1), true);
assert.ok(CINE_FILMS.every(f => f.titulo && !/marea baja/i.test(f.titulo)));
assert.ok(CINE_FILMS.some(f => /caza|azotea|fuga/i.test(f.id)));

const tramos = tramosSala(sala);
assert.ok(tramos.some(s => s.kind === 'pasillo' && s.ySur === 0 && s.yNorte === 0));
assert.ok(tramos.some(s => s.kind === 'plano' && s.ySur === 0 && s.yNorte === 0));
assert.ok(tramos.some(s => s.kind === 'sube' && s.ySur > s.yNorte));
assert.ok(tramos.some(s => s.kind === 'baja' && s.ySur < s.yNorte));

assert.equal(cineAlturaEn(cx, -28), 0);
assert.equal(cineAlturaEn(cx + 3, -28), null);
assert.equal(cineAlturaEn(cx, -32.4), 0);
assert.equal(cineAlturaEn(cx + 2.8, -32.4), 0);
const medioBajada = cineAlturaEn(cx, -35.7);
assert.ok(medioBajada < -0.3 && medioBajada > -0.65, 'bajada a media altura, salió ' + medioBajada);
const medioSubida = cineAlturaEn(cx - 2.4, -35.775);
assert.ok(medioSubida > 0.45 && medioSubida < 0.9, 'subida a media altura, salió ' + medioSubida);
assert.ok(Math.abs(cineAlturaEn(cx, -44) - (-0.92)) < 0.02);
assert.ok(Math.abs(cineAlturaEn(cx - 2.6, -39.2) - 1.32) < 0.02);
assert.equal(cineAlturaEn(27.5, -13), null);

const butacas = asientosDeSala(sala);
assert.ok(butacas.length >= 16, 'faltan butacas: ' + butacas.length);
assert.ok(butacas.filter(a => !a.libre).length >= 12);
assert.ok(butacas.filter(a => a.libre && a.fila === 'alta').length >= 2);
assert.ok(butacas.filter(a => a.libre && a.fila === 'baja').length >= 2);
for (const fila of butacas) {
  const y = cineAlturaEn(fila.standX, fila.standZ);
  assert.ok(y != null && Math.abs(y - fila.piso) < 0.05, 'el pasillo del asiento no está a la altura de la fila ' + fila.fila + ' z=' + fila.z);
  assert.ok(dentroDeTotu(fila.x, fila.z));
}

for (const s of tramosSala(0)) {
  assert.ok(s.minX > TOTU.x0 && s.maxX < TOTU.x1);
  assert.ok(s.minZ > TOTU.zS && s.maxZ < TOTU.zN);
}

let y = 0;
for (let z = -24.3; z >= -45.2; z -= 0.15) {
  const next = cineAlturaEn(cx, z);
  assert.ok(next != null, 'el centro se corta en z=' + z);
  assert.ok(Math.abs(next - y) < 0.22, 'el piso pega un salto de ' + Math.abs(next - y) + ' en z=' + z);
  y = next;
}
y = 0;
for (let z = -32.2; z >= -40.6; z -= 0.15) {
  const next = cineAlturaEn(cx - 2.3, z);
  assert.ok(next != null, 'la subida se corta en z=' + z);
  assert.ok(Math.abs(next - y) < 0.22, 'la subida pega un salto de ' + Math.abs(next - y) + ' en z=' + z);
  y = next;
}

const ctx = {
  clearRect() {}, fillRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
  arc() {}, ellipse() {}, save() {}, restore() {}, translate() {}, rotate() {},
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  setLineDash() {},
};
ctx.fillStyle = ''; ctx.strokeStyle = ''; ctx.font = ''; ctx.lineWidth = 1;
for (const f of CINE_FILMS) pintarCine(ctx, f, 20);

console.log('cine-totu ok');
