// Economía ficticia del parque. Un día comercial = seis minutos de juego activo.
export const PARK = Object.freeze({ price: 15000, capital: 15000, ticket: 200, seconds: 360, reserve: 6000, capacity: 180 });
export const CAMPAIGNS = Object.freeze({
  social: { name: 'Publicidad en redes', cost: 1800, days: 3, demand: 1.25, discount: 0 },
  family: { name: 'Promoción familiar −20%', cost: 600, days: 2, demand: 1.45, discount: .2 },
  radio: { name: 'Campaña radial', cost: 4200, days: 5, demand: 1.35, discount: 0 },
});
export function newPark() {
  return { cash: PARK.capital, invested: PARK.price + PARK.capital, withdrawn: 0, elapsed: 0, day: 0, condition: 100, open: true, campaign: null, pendingCosts: 0, history: [] };
}
export function parkDate(day) { return new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10); }
export function startCampaign(p, key) {
  const c = CAMPAIGNS[key];
  if (!c || p.campaign || p.cash < c.cost + PARK.reserve || !p.open) return false;
  p.cash -= c.cost; p.pendingCosts += c.cost; p.campaign = { key, left: c.days }; return true;
}
export function maintainPark(p) {
  if (p.cash < 3500 || p.condition >= 100) return false;
  p.cash -= 3500; p.pendingCosts += 3500; p.condition = Math.min(100, p.condition + 40); return true;
}
export function settleParkDay(p, random = Math.random) {
  const date = parkDate(p.day), weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  const month = Number(date.slice(5, 7));
  const weatherRoll = random(), weather = weatherRoll < .12 ? 'Tormenta' : weatherRoll < .38 ? 'Lluvia' : 'Despejado';
  const eventRoll = random(), event = eventRoll < .12 ? 'Baja demanda' : eventRoll > .88 ? 'Alta demanda' : 'Demanda normal';
  const closed = !p.open || p.cash < PARK.reserve || p.condition < 25;
  const c = p.campaign && CAMPAIGNS[p.campaign.key];
  const repair = !closed && random() < .03 + (100 - p.condition) / 600 ? 4500 : 0;
  const visitors = closed ? 0 : Math.min(PARK.capacity, Math.round(60 * (.65 + random() * .7) *
    ([0, 6].includes(weekday) ? 1.65 : 1) * ([1, 2, 12].includes(month) ? 1.25 : .9) *
    (weather === 'Tormenta' ? .12 : weather === 'Lluvia' ? .45 : 1) *
    (event === 'Baja demanda' ? .5 : event === 'Alta demanda' ? 1.4 : 1) *
    (.5 + p.condition / 200) * (c?.demand || 1) * (repair ? .5 : 1)));
  const ticket = PARK.ticket * (1 - (c?.discount || 0)), revenue = visitors * ticket;
  const costs = { personal: closed ? 900 : 2800, servicios: closed ? 200 : 700, seguros: 500,
    mantenimiento: closed ? 0 : 500, insumos: visitors * 28, averias: repair,
    acciones: p.pendingCosts, impuestos: Math.round(revenue * .1) };
  const expenses = Object.values(costs).reduce((a, b) => a + b, 0), profit = revenue - expenses;
  // Las acciones ya se pagaron al contratarlas; no descontarlas por segunda vez.
  p.cash += profit + p.pendingCosts; p.pendingCosts = 0;
  const row = { date, visitors, ticket, revenue, expenses, profit, costs, weather, event,
    campaign: c?.name || 'Sin campaña', status: closed ? 'Cerrado' : repair ? 'Avería parcial' : 'Abierto' };
  p.history.push(row); p.day++;
  p.condition = Math.max(0, p.condition - (closed ? .3 : 2 + visitors / 100));
  if (p.campaign && --p.campaign.left <= 0) p.campaign = null;
  return row;
}
export function parkReport(p, period = 'day') {
  const groups = new Map();
  for (const row of p.history) {
    const key = row.date.slice(0, period === 'year' ? 4 : period === 'month' ? 7 : 10);
    const total = groups.get(key) || { date: key, days: 0, visitors: 0, revenue: 0, expenses: 0, profit: 0 };
    for (const field of ['visitors', 'revenue', 'expenses', 'profit']) total[field] += row[field];
    total.days++; groups.set(key, total);
  }
  return [...groups.values()].reverse();
}
