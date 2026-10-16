// Totu + cine. El piso de cada sala es una rampa por tramos:
// entras al nivel de la calle, subes a la fila de atrás y bajas a la de adelante.

export const CINE_FILMS = Object.freeze([
  Object.freeze({ id: 'marea', titulo: 'Marea baja', precio: 80, sala: 0, dur: 46, linea: 'Un muelle al anochecer.' }),
  Object.freeze({ id: 'luz', titulo: 'La última luz', precio: 90, sala: 1, dur: 46, linea: 'La ciudad cuando se apaga el día.' }),
  Object.freeze({ id: 'sal', titulo: 'Camino de sal', precio: 100, sala: 2, dur: 46, linea: 'Una carretera con el sol bajo.' }),
]);

export const TOTU = Object.freeze({
  x0: 11.2,
  x1: 43.8,
  zN: -11.2,
  zS: -43.6,
  muro: 0.42,
  alto: 6.6,
  puertaNorte: Object.freeze({ x: 27.5, w: 3.4 }),
  puertaLobby: Object.freeze({ x: 27.5, w: 2.8 }),
  zTienda: -21.6,
  zLobby: -28.4,
  zSalas: -31.6,
  salasX: Object.freeze([11.2, 22.07, 32.93, 43.8]),
  senora: Object.freeze({ x: 39.4, z: -24.9 }),
  vendedor: Object.freeze({ x: 23.15, z: -19.15 }),
});

export function centroSala(i) {
  return (TOTU.salasX[i] + TOTU.salasX[i + 1]) / 2;
}

export function tramosSala(i) {
  const cx = centroSala(i);
  const x0 = TOTU.salasX[i] + 0.72;
  const x1 = TOTU.salasX[i + 1] - 0.72;
  const a = 1.05;
  return [
    { minX: x0, maxX: x1, minZ: -32.2, maxZ: -31.78, ySur: 0, yNorte: 0 },
    { minX: cx - a, maxX: cx + a, minZ: -34.5, maxZ: -32.2, ySur: 1.2, yNorte: 0 },
    { minX: x0, maxX: x1, minZ: -36.05, maxZ: -34.5, ySur: 1.2, yNorte: 1.2 },
    { minX: cx - a, maxX: cx + a, minZ: -38.5, maxZ: -36.05, ySur: 0.16, yNorte: 1.2 },
    { minX: x0, maxX: x1, minZ: -42.35, maxZ: -38.5, ySur: 0.16, yNorte: 0.16 },
  ];
}

export function alturaTramos(tramos, x, z) {
  let best = null;
  for (const s of tramos) {
    if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
    const span = s.maxZ - s.minZ || 1;
    const t = (z - s.minZ) / span;
    const y = s.ySur + (s.yNorte - s.ySur) * t;
    if (best == null || y > best) best = y;
  }
  return best;
}

export function cineAlturaEn(x, z) {
  for (let i = 0; i < 3; i++) {
    const y = alturaTramos(tramosSala(i), x, z);
    if (y != null) return y;
  }
  return null;
}

export function filmPorId(id) {
  return CINE_FILMS.find(f => f.id === id) || null;
}

export function puedeEntrar(boleto, sala) {
  return !!(boleto && boleto.sala === sala);
}

export function dentroDeTotu(x, z, margen = 0) {
  return x > TOTU.x0 - margen && x < TOTU.x1 + margen && z > TOTU.zS - margen && z < TOTU.zN + margen;
}

function barra(ctx, w, h) {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, 26);
  ctx.fillRect(0, h - 26, w, 26);
}
function vineta(ctx, w, h) {
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
function grano(ctx, w, h, t) {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let i = 0; i < 42; i++) {
    const x = (Math.sin(i * 12.9898 + t * 2.1) * 0.5 + 0.5) * w;
    const y = (Math.cos(i * 78.233 + t * 1.4) * 0.5 + 0.5) * h;
    ctx.fillRect(x, y, 2, 1);
  }
}
function titulo(ctx, w, texto, sub) {
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(0, 78, w, 86);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 34px Georgia, serif';
  ctx.fillText(texto, 36, 118);
  ctx.fillStyle = '#e7e5e4';
  ctx.font = '16px Georgia, serif';
  ctx.fillText(sub, 36, 146);
}
function silueta(ctx, x, y, s, caminando, t) {
  const paso = caminando ? Math.sin(t * 3.2) * 5 * s : 0;
  ctx.fillStyle = '#0c0a09';
  ctx.beginPath();
  ctx.ellipse(x, y - 46 * s, 8 * s, 10 * s, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 11 * s, y - 34 * s);
  ctx.quadraticCurveTo(x, y - 8 * s, x + 12 * s, y - 32 * s);
  ctx.lineTo(x + 7 * s, y);
  ctx.lineTo(x + 4 * s + paso, y + 28 * s);
  ctx.lineTo(x - 2 * s, y + 2 * s);
  ctx.lineTo(x - 6 * s - paso, y + 28 * s);
  ctx.lineTo(x - 9 * s, y);
  ctx.fill();
}

function cuadroMarea(ctx, w, h, u, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1e1b4b');
  g.addColorStop(.42, '#9a3412');
  g.addColorStop(.62, '#fdba74');
  g.addColorStop(1, '#1e3a4c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffedd5';
  ctx.beginPath();
  ctx.arc(520, 118, 28, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, 214);
  ctx.lineTo(180, 188);
  ctx.lineTo(260, 206);
  ctx.lineTo(0, 250);
  ctx.fill();
  const mar = ctx.createLinearGradient(0, 200, 0, h);
  mar.addColorStop(0, '#0e4a5c');
  mar.addColorStop(1, '#082f3a');
  ctx.fillStyle = mar;
  ctx.fillRect(0, 206, w, h);
  ctx.strokeStyle = 'rgba(255,237,213,.35)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const y = 230 + i * 12;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const yy = y + Math.sin(x * 0.04 + t * 1.4 + i) * 2.2;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const avance = Math.min(1, Math.max(0, (u - 8) / 28));
  const x0 = 250 - avance * 40;
  ctx.fillStyle = '#44403c';
  ctx.beginPath();
  ctx.moveTo(x0 - 70, h);
  ctx.lineTo(300, 214);
  ctx.lineTo(338, 214);
  ctx.lineTo(x0 + 120, h);
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,211,209,.35)';
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 - 60 + i * 22, h);
    ctx.lineTo(304 + i * 4, 220);
    ctx.stroke();
  }
  if (u > 16) silueta(ctx, 292 - avance * 18, 232, 0.85, u > 20 && u < 40, t);
  if (u < 8) titulo(ctx, w, 'MAREA BAJA', 'Un corto de Totu Cine');
  else if (u > 40) titulo(ctx, w, 'MAREA BAJA', 'Se queda en el muelle hasta que baja el agua');
}
function cuadroCiudad(ctx, w, h, u, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020617');
  g.addColorStop(.45, '#1e293b');
  g.addColorStop(.72, '#334155');
  g.addColorStop(1, '#0f172a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) {
    const bw = 28 + (i % 4) * 14;
    const bh = 70 + ((i * 37) % 120);
    const x = 12 + i * 40;
    ctx.fillStyle = i % 2 ? '#0f172a' : '#111827';
    ctx.fillRect(x, 250 - bh, bw, bh);
    for (let wy = 0; wy < 8; wy++) for (let wx = 0; wx < 2; wx++) {
      const on = ((i + wy + Math.floor(t * 0.7)) % 4) !== 0;
      ctx.fillStyle = on ? 'rgba(253,224,71,.85)' : 'rgba(30,41,59,.4)';
      ctx.fillRect(x + 6 + wx * 12, 258 - bh + wy * 14, 6, 7);
    }
  }
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 250, w, h - 250);
  ctx.fillStyle = 'rgba(148,163,184,.25)';
  ctx.fillRect(70, 268, w - 140, 8);
  for (let i = 0; i < 6; i++) {
    const x = ((t * 48 + i * 110) % (w + 80)) - 40;
    ctx.fillStyle = 'rgba(251,191,36,.8)';
    ctx.fillRect(x, 292, 26, 3);
    ctx.fillStyle = 'rgba(248,113,113,.75)';
    ctx.fillRect(w - x, 304, 18, 3);
  }
  ctx.fillStyle = 'rgba(226,232,240,.08)';
  ctx.fillRect(0, 250, w, 70);
  if (u < 8) titulo(ctx, w, 'LA ÚLTIMA LUZ', 'Un corto de Totu Cine');
  else if (u > 38) titulo(ctx, w, 'LA ÚLTIMA LUZ', 'La calle sigue mojada cuando ya no hay nadie');
}
function cuadroRuta(ctx, w, h, u, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7c2d12');
  g.addColorStop(.38, '#ea580c');
  g.addColorStop(.58, '#fdba74');
  g.addColorStop(1, '#a16207');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(110, 92, 26, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.lineTo(120, 168);
  ctx.lineTo(230, 196);
  ctx.lineTo(360, 150);
  ctx.lineTo(520, 188);
  ctx.lineTo(w, 160);
  ctx.lineTo(w, 230);
  ctx.lineTo(0, 236);
  ctx.fill();
  ctx.fillStyle = '#44403c';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 8, 188);
  ctx.lineTo(80, h);
  ctx.lineTo(w - 80, h);
  ctx.lineTo(w / 2 + 8, 188);
  ctx.fill();
  ctx.strokeStyle = 'rgba(254,243,199,.7)';
  ctx.setLineDash([10, 16]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 190);
  ctx.lineTo(w / 2 + Math.sin(t) * 6, h);
  ctx.stroke();
  ctx.setLineDash([]);
  const coche = 250 + Math.sin(t * 0.8) * 10;
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(coche, 236, 78, 28);
  ctx.fillStyle = '#292524';
  ctx.fillRect(coche + 16, 222, 46, 18);
  ctx.fillStyle = '#fb7185';
  ctx.fillRect(coche + 4, 244, 8, 6);
  ctx.fillRect(coche + 66, 244, 8, 6);
  ctx.fillStyle = 'rgba(120,53,15,.25)';
  ctx.fillRect(0, 200, w, 40);
  if (u < 8) titulo(ctx, w, 'CAMINO DE SAL', 'Un corto de Totu Cine');
  else if (u > 38) titulo(ctx, w, 'CAMINO DE SAL', 'Sigue derecho. El sol no apura.');
}

export function pintarCine(ctx, film, t) {
  const w = 640, h = 360;
  const dur = film.dur || 46;
  const u = ((t % dur) + dur) % dur;
  ctx.clearRect(0, 0, w, h);
  if (film.id === 'luz') cuadroCiudad(ctx, w, h, u, t);
  else if (film.id === 'sal') cuadroRuta(ctx, w, h, u, t);
  else cuadroMarea(ctx, w, h, u, t);
  grano(ctx, w, h, t);
  vineta(ctx, w, h);
  barra(ctx, w, h);
}

export function asientosDeSala(i) {
  const cx = centroSala(i);
  const altos = [-2.15, 2.15].map(dx => ({
    x: cx + dx, z: -35.25, piso: 1.2, fila: 'alta',
    standX: cx + Math.sign(dx) * 1.15, standZ: -35.25,
  }));
  const bajos = [-2.15, 2.15].map(dx => ({
    x: cx + dx, z: -40.15, piso: 0.16, fila: 'baja',
    standX: cx + Math.sign(dx) * 1.15, standZ: -40.15,
  }));
  return [...altos, ...bajos];
}
