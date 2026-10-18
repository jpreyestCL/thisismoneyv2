import assert from 'node:assert/strict';
import { LUGARES, enCalle, rutaDePatrulla, segmentoSobreCalle } from './city-map.js';

const PUERTA = { x: LUGARES.carcel.x, z: LUGARES.carcel.z + 35 / 2 + 4 };

function largo(ruta) {
  let s = 0;
  for (let i = 1; i < ruta.length; i++) s += Math.hypot(ruta[i].x - ruta[i - 1].x, ruta[i].z - ruta[i - 1].z);
  return s;
}

function revisar(nombre, x, z, tope) {
  const ruta = rutaDePatrulla(x, z, PUERTA.x, PUERTA.z);
  assert.ok(ruta.length >= 2, nombre + ' no arma camino');
  const fin = ruta[ruta.length - 1];
  assert.ok(Math.hypot(fin.x - PUERTA.x, fin.z - PUERTA.z) < 1, nombre + ' no llega a la cárcel');
  for (let i = 1; i < ruta.length; i++) {
    const a = ruta[i - 1], b = ruta[i];
    const enCalleElTramo = segmentoSobreCalle(a, b);
    const cortoALaPuerta = i === ruta.length - 1 && Math.hypot(b.x - PUERTA.x, b.z - PUERTA.z) < 1 && Math.hypot(a.x - b.x, a.z - b.z) < 12;
    assert.ok(enCalleElTramo || cortoALaPuerta, nombre + ' se sale de la calle en ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b));
    const pasos = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
    for (let k = 0; k <= pasos; k++) {
      const t = k / pasos;
      const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t;
      assert.ok(enCalle(px, pz), nombre + ' pisa fuera de la calle en ' + px.toFixed(1) + ',' + pz.toFixed(1));
    }
  }
  const metros = largo(ruta);
  assert.ok(metros < tope, nombre + ' da un rodeo de ' + Math.round(metros) + ' m');
  return ruta;
}

const desdeCasa = revisar('casa', 14, 14, 90);
assert.ok(desdeCasa.every((p, i) => i === 0 || p.x >= desdeCasa[i - 1].x - 0.2), 'desde la casa el patrulla no debe volver hacia el oeste');
assert.ok(desdeCasa.slice(0, -1).every(p => Math.abs(p.z) < 0.2), 'desde la casa debe tomar la avenida z=0 y no meterse a otra manzana');

const enLaAvenida = revisar('avenida', 20, 0, 80);
assert.equal(enLaAvenida[0].x, 20);
assert.ok(enLaAvenida[1].x > 70, 'ya en la calle, sigue por esa avenida hasta el frente de la cárcel');

revisar('banco', LUGARES.banco.x, LUGARES.banco.z, 280);
revisar('desierto', 215, -80, 420);
revisar('playa', LUGARES.playa.x, LUGARES.playa.z, 520);

const juntoALaPuerta = revisar('puerta', PUERTA.x, PUERTA.z - 1, 40);
assert.ok(largo(juntoALaPuerta) < 20, 'junto a la cárcel no da la vuelta a la manzana');
