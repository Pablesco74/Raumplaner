'use strict';

// Varianten-Datenmodell: "+ Neue Variante" dupliziert standardmäßig
// Möbel + Bodenbelag der aktuell aktiven Variante (Aufgabe 3).

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-scripts');

function makeCtx() {
  return loadScripts(['constants.js', 'storage.js', 'migration.js', 'geometry.js', 'store.js']);
}

test('addVariant übernimmt Möbel + Bodenbelag der aktiven Variante', () => {
  const ctx = makeCtx();
  const room = ctx.makeRoom('Test');
  room.items.push({ id: 1, name: 'Sofa', w: 160, d: 80, x: 10, y: 10, rot: 0, doors: 0, color: {}, locked: false });
  room.nextId = 2;
  room.floorType = 'holz';

  const v = ctx.addVariant(room);

  assert.equal(v.items.length, 1);
  assert.equal(v.items[0].name, 'Sofa');
  assert.equal(v.floorType, 'holz');
  assert.equal(room.items.length, 1, 'neue Variante ist nach dem Anlegen aktiv und zeigt die übernommenen Möbel');
});

test('addVariant erzeugt eine unabhängige Kopie der Möbelliste (kein geteiltes Array)', () => {
  const ctx = makeCtx();
  const room = ctx.makeRoom('Test');
  room.items.push({ id: 1, name: 'Sofa', w: 160, d: 80, x: 10, y: 10, rot: 0, doors: 0, color: {}, locked: false });
  room.nextId = 2;

  const v = ctx.addVariant(room);
  v.items[0].name = 'Bett';

  assert.equal(room.variants[0].items[0].name, 'Sofa', 'Ursprungsvariante bleibt unverändert');
});

test('addVariant vergibt fortlaufende Nummerierung "Variante N" (höchste bestehende Nummer + 1)', () => {
  const ctx = makeCtx();
  const room = ctx.makeRoom('Test'); // "Variante 1"

  const v2 = ctx.addVariant(room);
  assert.equal(v2.name, 'Variante 2');

  const v3 = ctx.addVariant(room);
  assert.equal(v3.name, 'Variante 3');
});

test('Nummerierung ignoriert umbenannte Varianten und bleibt bei der höchsten Zahl im Raum', () => {
  const ctx = makeCtx();
  const room = ctx.makeRoom('Test');
  room.variants[0].name = 'Wohnzimmer-Setup';

  const v = ctx.addVariant(room); // keine "Variante N" vorhanden -> Start bei 1
  assert.equal(v.name, 'Variante 1');

  room.variants[1].name = 'Variante 5';
  const v2 = ctx.addVariant(room); // dupliziert von "Variante 5", aber Nummerierung ist unabhängig vom Quellnamen
  assert.equal(v2.name, 'Variante 6');
});

test('addVariant macht die neue Variante zur aktiven Variante', () => {
  const ctx = makeCtx();
  const room = ctx.makeRoom('Test');
  const v = ctx.addVariant(room);

  assert.equal(room.currentVariantIdx, 1);
  assert.equal(room.variants[room.currentVariantIdx].id, v.id);
});
