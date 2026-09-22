// Reglas del CHAT MUNDIAL. Las usan el navegador (index.html) y la API del
// servidor (server/leaderboard.mjs) para que el mensaje que se ve en pantalla
// sea exactamente el que queda guardado: mismo largo, misma limpieza y el
// mismo filtro de groserías. El juego lo juegan niños: por eso los enlaces se
// tapan y las palabras feas se reemplazan antes de llegar al muro.

export const CHAT_MAX_LEN = 140;        // un mensaje corto se lee de una pasada
export const CHAT_BUBBLE_MS = 7000;     // el globo en pantalla dura 7 segundos y se va solo
export const CHAT_SEND_GAP_MS = 2500;   // espera mínima entre dos mensajes del mismo jugador
export const CHAT_HISTORY = 40;         // cuántos mensajes muestra el muro
export const CHAT_NAME_MAX = 20;
export const CHAT_STICKER_PREFIX = 'sticker:';
export const CHAT_CUSTOM_PREFIX = 'sticker:img:';
export const CHAT_CUSTOM_MAX = 11000;  // jpeg en base64 (foto chica, no un álbum)
export const CHAT_CUSTOM_LABEL_MAX = 16;

// Emojis del teclado del muro (se meten en el texto que estás escribiendo).
export const CHAT_EMOJIS = [
  '😀', '😂', '😍', '🤩', '😎', '🥳', '😭', '😡', '😱', '😴', '🤔', '🙃',
  '👍', '👎', '❤️', '🔥', '✨', '🎉', '🙏', '💪', '👋', '👀', '💀', '🧟',
  '⚽', '🏆', '🚗', '🚀', '🌍', '💰', '🏠', '👨', '👩', '🐶', '🌟', '🍕',
  '🎮', '☀️', '🌙', '❄️', '🌈', '👻', '🛡️', '❤️‍🔥',
];

// Stickers: un toque manda el dibujo grande (no se mezcla con el texto).
export const CHAT_STICKERS = [
  { id: 'hola', emoji: '👋', label: 'Hola' },
  { id: 'risa', emoji: '😂', label: 'Risa' },
  { id: 'love', emoji: '❤️', label: 'Corazón' },
  { id: 'fuego', emoji: '🔥', label: 'Fuego' },
  { id: 'gol', emoji: '⚽', label: 'Gol' },
  { id: 'plata', emoji: '💰', label: 'Plata' },
  { id: 'casa', emoji: '🏠', label: 'Casa' },
  { id: 'zombi', emoji: '🧟', label: 'Zombi' },
  { id: 'cohete', emoji: '🚀', label: 'Cohete' },
  { id: 'ok', emoji: '👍', label: 'Ok' },
  { id: 'wow', emoji: '🤩', label: 'Wow' },
  { id: 'gg', emoji: '🏆', label: 'GG' },
  { id: 'noche', emoji: '🌙', label: 'Noche' },
  { id: 'planeta', emoji: '🪐', label: 'Planeta' },
  { id: 'perro', emoji: '🐶', label: 'Perro' },
  { id: 'juego', emoji: '🎮', label: 'Play' },
];
export function stickerPayload(id) {
  const s = CHAT_STICKERS.find(x => x.id === id);
  return s ? CHAT_STICKER_PREFIX + s.id : '';
}

function b64Head(b64) {
  const slice = String(b64 || '').slice(0, 24);
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(slice, 'base64');
    const bin = atob(slice);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch (e) { return null; }
}

// Solo JPEG: el cliente convierte foto/dibujo a jpeg, así no entra SVG ni un enlace.
export function isJpegBase64(b64) {
  const s = String(b64 || '');
  if (s.length < 64 || s.length > CHAT_CUSTOM_MAX) return false;
  if (s.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return false;
  const bytes = b64Head(s);
  return !!(bytes && bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8);
}

export function cleanStickerLabel(value) {
  return String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/[:|]/g, '').trim().slice(0, CHAT_CUSTOM_LABEL_MAX) || 'Sticker';
}

export function customStickerPayload(label, jpegB64) {
  const name = cleanStickerLabel(label);
  const b64 = String(jpegB64 || '').replace(/\s+/g, '');
  if (!isJpegBase64(b64)) return '';
  return CHAT_CUSTOM_PREFIX + name + ':' + b64;
}

function parseCustomSticker(text) {
  const raw = String(text || '');
  if (!raw.startsWith(CHAT_CUSTOM_PREFIX)) return null;
  const rest = raw.slice(CHAT_CUSTOM_PREFIX.length);
  const cut = rest.indexOf(':');
  if (cut < 1) return null;
  const label = cleanStickerLabel(rest.slice(0, cut));
  const b64 = rest.slice(cut + 1);
  if (!isJpegBase64(b64)) return null;
  return { id: 'img', custom: true, emoji: '🖼️', label, b64, src: 'data:image/jpeg;base64,' + b64 };
}

export function stickerFromText(text) {
  const raw = String(text || '');
  const custom = parseCustomSticker(raw);
  if (custom) return custom;
  if (!raw.startsWith(CHAT_STICKER_PREFIX) || raw.startsWith(CHAT_CUSTOM_PREFIX)) return null;
  return CHAT_STICKERS.find(s => s.id === raw.slice(CHAT_STICKER_PREFIX.length)) || null;
}

// Raíces de groserías (sin tildes ni mayúsculas). Se tapan también sus plurales
// y su género: "putas" y "culiaos" caen con "puta" y "culiao". Las terminaciones
// permitidas son solo esas, para no tapar palabras normales que empiezan igual
// ("conocí", "Vergara", "estupidez" no son groserías).
const BAD_ROOTS = [
  'conchetumadre', 'conchetumare', 'ctm', 'culiao', 'culia', 'maricon', 'maraco',
  'puta', 'puto', 'mierda', 'verga', 'pendejo', 'pichula', 'zorra',
  'joder', 'gilipollas', 'chupalo', 'imbecil', 'estupido',
];
const BAD_SUFFIXES = ['', 's', 'es', 'a', 'as', 'o', 'os'];
const LINKS = /\b(?:https?:\/\/|www\.)\S+/gi;
const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
// El "unidor" invisible arma los emoji de familia (👨‍👩‍👧). El selector de
// emoji (❤️) y las etiquetas de banderas (🏴󠁧󠁢󠁳󠁣󠁴󠁿) también tienen que quedar.
const ZWJ = String.fromCharCode(0x200d);
function keepChatFormat(c) {
  const cp = c.codePointAt(0);
  return c === ZWJ || cp === 0xfe0e || cp === 0xfe0f || (cp >= 0xe0020 && cp <= 0xe007f);
}
function clipChatChars(text, max) {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max).join('');
}

// "Culiaoo" y "CULIAO" son la misma palabra: comparamos sin tildes ni signos.
function fold(word) {
  return word.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
}
function isBad(word) {
  const w = fold(word);
  if (!w) return false;
  return BAD_ROOTS.some(root => w.startsWith(root) && BAD_SUFFIXES.includes(w.slice(root.length)));
}

export function maskBadWords(text) {
  return String(text).replace(/[\p{L}\p{N}]+/gu, w => (isBad(w) ? '***' : w));
}

// Deja el mensaje listo para guardar: sin caracteres de control, sin enlaces,
// en una sola línea y recortado. Devuelve '' si no queda nada que decir.
export function cleanChatText(value) {
  const incoming = String(value ?? '');
  // Foto/dibujo: no pasa por el recorte de 140 letras. Si viene mal armado, no se guarda.
  if (incoming.trim().startsWith(CHAT_CUSTOM_PREFIX)) {
    const parsed = parseCustomSticker(incoming.trim());
    return parsed ? customStickerPayload(parsed.label, parsed.b64) : '';
  }
  const text = clipChatChars(incoming
    .normalize('NFKC')
    .replace(CONTROL, c => (keepChatFormat(c) ? c : ' '))
    .replace(LINKS, '(enlace)')
    .replace(/\s+/g, ' ')
    .trim(), CHAT_MAX_LEN);
  const sticker = stickerFromText(text);
  if (sticker && !sticker.custom) return stickerPayload(sticker.id);
  return maskBadWords(text).trim();
}

// Nombre visible: letras, números y separadores simples. Nunca queda vacío.
export function cleanChatName(value) {
  return String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, CHAT_NAME_MAX) || 'Jugador';
}

// Nombre de cuenta para guardar en la nube: puede quedar vacío (así el cliente pide uno).
export function cleanAccountName(value) {
  return String(value || '').normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, CHAT_NAME_MAX);
}
// Clave única: sin tildes ni mayúsculas, para que "José" y "jose" sean el mismo usuario.
export function accountNameKey(value) {
  return cleanAccountName(value).normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
}

// Milisegundos que faltan para poder mandar otro mensaje (0 = puede escribir ya).
export function chatSendWait(lastSentAt, now = Date.now()) {
  if (!lastSentAt) return 0;
  return Math.max(0, CHAT_SEND_GAP_MS - (now - lastSentAt));
}

// Hora corta (14:05) para la lista del muro.
export function chatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
