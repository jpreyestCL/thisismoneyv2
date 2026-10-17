// Totu + cine. Cada sala: un pasillo plano (sin escaleras), una zona plana
// para elegir, y desde ahí se sube por los lados o se baja por el centro.

export const CINE_FILMS = Object.freeze([
  Object.freeze({ id: 'caza', titulo: 'Caza en el muelle', precio: 80, sala: 0, dur: 48, linea: 'Dos lanchas y un salto cuando la marea cierra el paso.' }),
  Object.freeze({ id: 'azotea', titulo: 'Azotea 9', precio: 90, sala: 1, dur: 48, linea: 'Una carrera por los techos antes de que se apaguen las luces.' }),
  Object.freeze({ id: 'fuga', titulo: 'Fuga de sal', precio: 100, sala: 2, dur: 48, linea: 'Dos autos, una duna y un sol que no espera.' }),
]);

export const TOTU = Object.freeze({
  x0: 8.4,
  x1: 46.6,
  zN: -8.4,
  zS: -46.6,
  muro: 0.42,
  alto: 7.4,
  puertaNorte: Object.freeze({ x: 27.5, w: 3.4 }),
  puertaLobby: Object.freeze({ x: 27.5, w: 2.8 }),
  zTienda: -17.6,
  zLobby: -21.4,
  zSalas: -24.0,
  salasX: Object.freeze([8.4, 21.1333, 33.8667, 46.6]),
  senora: Object.freeze({ x: 41.2, z: -19.5 }),
  vendedor: Object.freeze({ x: 16.4, z: -13.0 }),
});

const PASILLO = 1.12;
const SEP = 1.42;

export function centroSala(i) {
  return (TOTU.salasX[i] + TOTU.salasX[i + 1]) / 2;
}

export function tramosSala(i) {
  const cx = centroSala(i);
  const x0 = TOTU.salasX[i] + 0.78;
  const x1 = TOTU.salasX[i + 1] - 0.78;
  return [
    { kind: 'pasillo', minX: cx - PASILLO, maxX: cx + PASILLO, minZ: -31.15, maxZ: -24.15, ySur: 0, yNorte: 0 },
    { kind: 'plano', minX: x0, maxX: x1, minZ: -33.85, maxZ: -31.15, ySur: 0, yNorte: 0 },
    { kind: 'baja', minX: cx - PASILLO, maxX: cx + PASILLO, minZ: -37.55, maxZ: -33.85, ySur: -0.92, yNorte: 0 },
    { kind: 'bajaPlato', minX: cx - PASILLO, maxX: cx + PASILLO, minZ: -41.35, maxZ: -37.55, ySur: -0.92, yNorte: -0.92 },
    { kind: 'bajaPlato', minX: x0, maxX: x1, minZ: -45.55, maxZ: -41.35, ySur: -0.92, yNorte: -0.92 },
    { kind: 'sube', minX: x0, maxX: cx - SEP, minZ: -37.7, maxZ: -33.85, ySur: 1.32, yNorte: 0 },
    { kind: 'sube', minX: cx + SEP, maxX: x1, minZ: -37.7, maxZ: -33.85, ySur: 1.32, yNorte: 0 },
    { kind: 'alta', minX: x0, maxX: cx - SEP, minZ: -41.15, maxZ: -37.7, ySur: 1.32, yNorte: 1.32 },
    { kind: 'alta', minX: cx + SEP, maxX: x1, minZ: -41.15, maxZ: -37.7, ySur: 1.32, yNorte: 1.32 },
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

function pasos(desde, hasta, paso) {
  if (hasta < desde - 1e-6) return [];
  const n = Math.max(1, Math.floor((hasta - desde) / paso + 1e-6) + 1);
  if (n === 1) return [desde];
  const real = (hasta - desde) / (n - 1);
  const lista = [];
  for (let i = 0; i < n; i++) lista.push(desde + real * i);
  return lista;
}

export function asientosDeSala(i) {
  const cx = centroSala(i);
  const x0 = TOTU.salasX[i] + 1.2;
  const x1 = TOTU.salasX[i + 1] - 1.2;
  const asientos = [];
  const poner = (x, z, piso, fila) => {
    asientos.push({ x, z, piso, fila, libre: false, standX: x, standZ: z });
  };
  for (const z of [-38.35, -39.9]) {
    for (const x of pasos(x0 + 0.35, cx - 2.55, 0.9)) poner(x, z, 1.32, 'alta');
    for (const x of pasos(cx + 2.55, x1 - 0.35, 0.9)) poner(x, z, 1.32, 'alta');
  }
  for (const z of [-42.55, -43.9]) {
    for (const x of pasos(x0 + 0.2, x1 - 0.2, 0.95)) {
      if (Math.abs(x - cx) < 1.65) continue;
      poner(x, z, -0.92, 'baja');
    }
  }
  const liberar = (fila, z, haciaCentro) => {
    const grupo = asientos.filter(a => a.fila === fila && Math.abs(a.z - z) < 0.02);
    const izq = grupo.filter(a => a.x < cx).sort((a, b) => b.x - a.x)[0];
    const der = grupo.filter(a => a.x > cx).sort((a, b) => a.x - b.x)[0];
    for (const a of [izq, der]) {
      if (!a) continue;
      a.libre = true;
      if (haciaCentro) {
        a.standX = a.x + Math.sign(cx - a.x) * 0.7;
        a.standZ = a.z;
      } else {
        a.standX = a.x;
        a.standZ = a.z + 0.95;
      }
    }
  };
  liberar('alta', -38.35, true);
  liberar('baja', -42.55, false);
  return asientos;
}

function barra(ctx, w, h) {
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, 26);
  ctx.fillRect(0, h - 26, w, 26);
}
function vineta(ctx, w, h) {
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.55)');
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
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(0, 78, w, 92);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 34px Georgia, serif';
  ctx.fillText(texto, 36, 118);
  ctx.fillStyle = '#e7e5e4';
  ctx.font = '16px Georgia, serif';
  ctx.fillText(sub, 36, 148);
}
function corredor(ctx, x, y, s, t, mira) {
  const paso = Math.sin(t * 9) * 7 * s;
  const lean = mira * 0.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = '#0c0a09';
  ctx.beginPath();
  ctx.ellipse(0, -48 * s, 7 * s, 9 * s, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8 * s, -36 * s);
  ctx.lineTo(10 * s, -34 * s);
  ctx.lineTo(6 * s, -4 * s);
  ctx.lineTo(-7 * s, -2 * s);
  ctx.fill();
  ctx.fillRect(-16 * s, -30 * s + paso, 5 * s, 22 * s);
  ctx.fillRect(12 * s, -30 * s - paso, 5 * s, 22 * s);
  ctx.fillRect(-8 * s, -2 * s, 4 * s, 18 * s + paso * 0.3);
  ctx.fillRect(3 * s, -2 * s, 4 * s, 18 * s - paso * 0.3);
  ctx.restore();
}
function lancha(ctx, x, y, w, color, proa) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.lineTo(x + w * 0.35, y - 10);
  ctx.lineTo(x + w * 0.5 * proa, y + 4);
  ctx.lineTo(x + w * 0.2, y + 16);
  ctx.lineTo(x - w * 0.45, y + 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(226,232,240,.8)';
  ctx.fillRect(x - 6, y - 4, 16, 7);
}

function cuadroCaza(ctx, w, h, u, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020617');
  g.addColorStop(.35, '#1e1b4b');
  g.addColorStop(.62, '#0f2942');
  g.addColorStop(1, '#082f49');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(40, 48, 2, 2);
  ctx.fillRect(180, 70, 2, 2);
  ctx.fillRect(420, 36, 2, 2);
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 168, 90, 14);
  ctx.fillRect(520, 150, 120, 16);
  for (const x of [18, 48, 78]) {
    ctx.fillRect(x, 150, 6, 40);
  }
  const agua = ctx.createLinearGradient(0, 180, 0, h);
  agua.addColorStop(0, '#0e7490');
  agua.addColorStop(1, '#082f49');
  ctx.fillStyle = agua;
  ctx.fillRect(0, 182, w, h);
  const avance = Math.min(1, Math.max(0, (u - 6) / 36));
  const x1 = 80 + avance * 280;
  const x2 = 20 + avance * 250;
  const salto = u > 16 && u < 27;
  lancha(ctx, x1, 214, 78, '#0f172a', 1);
  lancha(ctx, x2, 248, 90, '#7f1d1d', 1);
  ctx.strokeStyle = 'rgba(226,232,240,.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x2 - 20, 262);
  ctx.lineTo(x2 - 90 - avance * 40, 270);
  ctx.stroke();
  if (salto) {
    const k = (u - 16) / 11;
    const sx = x1 - 10 + k * 70;
    const sy = 200 - Math.sin(k * Math.PI) * 48;
    corredor(ctx, sx, sy, 0.7, t, 1);
  } else if (u >= 27 && u < 44) {
    corredor(ctx, x1 + 18, 206, 0.62, t * 1.4, 1);
  }
  if (u > 30 && u < 42) {
    ctx.fillStyle = 'rgba(251,191,36,.85)';
    ctx.beginPath();
    ctx.arc(x2 + 30, 230, 10 + (u - 30), 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(248,250,252,.35)';
    ctx.beginPath();
    ctx.arc(x2 + 10, 268, 16 + (u - 30) * 1.4, 0, 7);
    ctx.fill();
  }
  if (u < 6) titulo(ctx, w, 'CAZA EN EL MUELLE', 'Un corto de Totu Cine');
  else if (u > 43) titulo(ctx, w, 'CAZA EN EL MUELLE', 'Se metió por donde la marea ya no deja pasar');
}
function cuadroAzotea(ctx, w, h, u, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#020617');
  g.addColorStop(.5, '#172554');
  g.addColorStop(1, '#0f172a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const apagadas = Math.min(5, Math.max(0, Math.floor((u - 28) / 2)));
  for (let i = 0; i < 8; i++) {
    const bh = 90 + (i % 3) * 28;
    const x = 20 + i * 78;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(x, 250 - bh, 64, bh);
    for (let wy = 0; wy < 4; wy++) {
      const muerta = i < apagadas;
      ctx.fillStyle = muerta ? 'rgba(30,41,59,.35)' : 'rgba(253,224,71,.8)';
      ctx.fillRect(x + 10, 258 - bh + wy * 16, 8, 8);
      ctx.fillRect(x + 28, 258 - bh + wy * 16, 8, 8);
    }
  }
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 232, 210, 18);
  ctx.fillRect(250, 214, 160, 18);
  ctx.fillRect(450, 228, 190, 18);
  const carrera = Math.min(1, Math.max(0, (u - 6) / 34));
  const salto = u > 18 && u < 28;
  let x = 70 + carrera * 360;
  let y = 228;
  if (salto) {
    const k = (u - 18) / 10;
    x = 210 + k * 90;
    y = 220 - Math.sin(k * Math.PI) * 54;
  } else if (u >= 28) {
    x = 340 + (u - 28) * 8;
    y = 214;
  }
  corredor(ctx, x, y, 0.85, t * 1.3, 1);
  if (u > 10) corredor(ctx, x - 78, salto ? 236 : y + 6, 0.78, t * 1.3 + 1, 1);
  const haz = 180 + Math.sin(t * 0.7) * 80;
  ctx.fillStyle = 'rgba(254,249,195,.13)';
  ctx.beginPath();
  ctx.moveTo(haz, 0);
  ctx.lineTo(x - 30, y);
  ctx.lineTo(x + 30, y);
  ctx.fill();
  if (u < 6) titulo(ctx, w, 'AZOTEA 9', 'Un corto de Totu Cine');
  else if (u > 43) titulo(ctx, w, 'AZOTEA 9', 'La última luz fue la del helicóptero');
}
function cuadroFuga(ctx, w, h, u, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7c2d12');
  g.addColorStop(.4, '#c2410c');
  g.addColorStop(.62, '#fdba74');
  g.addColorStop(1, '#a16207');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(520, 78, 22, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#9a3412';
  ctx.beginPath();
  ctx.moveTo(0, 200);
  ctx.lineTo(140, 160);
  ctx.lineTo(280, 188);
  ctx.lineTo(430, 150);
  ctx.lineTo(w, 176);
  ctx.lineTo(w, 230);
  ctx.lineTo(0, 236);
  ctx.fill();
  ctx.fillStyle = '#44403c';
  ctx.beginPath();
  ctx.moveTo(300, 196);
  ctx.lineTo(40, h);
  ctx.lineTo(w - 30, h);
  ctx.lineTo(360, 196);
  ctx.fill();
  const spin = u > 22 && u < 34;
  const salto = u > 34 && u < 43;
  const leadX = 250 + Math.min(u, 40) * 4;
  const chaseX = leadX - 130;
  const auto = (x, y, color, giro) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(giro);
    ctx.fillStyle = color;
    ctx.fillRect(-36, -12, 74, 26);
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(-8, -24, 34, 14);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(30, -4, 8, 6);
    ctx.restore();
  };
  let leadY = 236;
  if (salto) leadY = 236 - Math.sin(((u - 34) / 9) * Math.PI) * 36;
  auto(Math.min(leadX, 470), leadY, '#0f172a', Math.sin(t * 2) * 0.04);
  const giro = spin ? (u - 22) * 0.35 : 0;
  auto(spin ? chaseX - 10 : Math.min(chaseX, 360), 250, '#7f1d1d', giro);
  ctx.fillStyle = 'rgba(254,243,199,.35)';
  ctx.beginPath();
  ctx.ellipse(chaseX - 20, 286, 50 + (u % 8) * 3, 10, 0, 0, 7);
  ctx.fill();
  if (u < 6) titulo(ctx, w, 'FUGA DE SAL', 'Un corto de Totu Cine');
  else if (u > 43) titulo(ctx, w, 'FUGA DE SAL', 'El sol se quedó atrás');
}

export function pintarCine(ctx, film, t) {
  const w = 640, h = 360;
  const dur = film.dur || 48;
  const u = ((t % dur) + dur) % dur;
  ctx.clearRect(0, 0, w, h);
  if (film.id === 'azotea') cuadroAzotea(ctx, w, h, u, t);
  else if (film.id === 'fuga') cuadroFuga(ctx, w, h, u, t);
  else cuadroCaza(ctx, w, h, u, t);
  grano(ctx, w, h, t);
  vineta(ctx, w, h);
  barra(ctx, w, h);
}
