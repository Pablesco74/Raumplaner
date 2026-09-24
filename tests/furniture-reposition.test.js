'use strict';

// Möbel-Neupositionierung nach Raumform-Änderung (Aufgabe 6): Ein Möbel-
// stück, das ganz oder teilweise außerhalb der (neuen) Raumfläche liegt,
// wird minimal an eine gültige Position innerhalb verschoben, Rotation
// bleibt erhalten. Gilt variantenübergreifend (repositionItemsAfterShapeChange).

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-scripts');

function makeCtx() {
  return loadScripts(['constants.js', 'storage.js', 'migration.js', 'geometry.js', 'store.js']);
}

test('itemFitsInShape: Möbel vollständig innerhalb erkennt korrekt', () => {
  const ctx = makeCtx();
  const shape = ctx.shapeFromRect(400, 300);
  const item = { x: 100, y: 100, w: 50, d: 50, rot: 0 };
  assert.equal(ctx.itemFitsInShape(item, shape), true);
});

test('itemFitsInShape: Möbel außerhalb erkennt korrekt', () => {
  const ctx = makeCtx();
  const shape = ctx.shapeFromRect(400, 300);
  const item = { x: -30, y: 100, w: 50, d: 50, rot: 0 };
  assert.equal(ctx.itemFitsInShape(item, shape), false);
});

test('repositionItemIntoShape lässt ein bereits passendes Möbelstück unverändert', () => {
  const ctx = makeCtx();
  const shape = ctx.shapeFromRect(400, 300);
  const item = { x: 100, y: 100, w: 50, d: 50, rot: 0 };
  const changed = ctx.repositionItemIntoShape(item, shape);
  assert.equal(changed, false);
  assert.equal(item.x, 100);
  assert.equal(item.y, 100);
});

test('repositionItemIntoShape verschiebt ein außerhalb liegendes Möbelstück zurück ins Innere, Rotation bleibt erhalten', () => {
  const ctx = makeCtx();
  const shape = ctx.shapeFromRect(400, 300);
  const item = { x: -30, y: 100, w: 50, d: 50, rot: 90 };
  const changed = ctx.repositionItemIntoShape(item, shape);
  assert.equal(changed, true);
  assert.equal(item.rot, 90, 'Rotation darf sich nicht ändern');
  assert.equal(ctx.itemFitsInShape(item, shape), true, 'Möbel muss nach Verschiebung innerhalb liegen');
});

test('repositionItemsAfterShapeChange korrigiert Möbel in allen Varianten, da die Form variantenübergreifend gilt', () => {
  const ctx = makeCtx();
  const room = ctx.makeRoom('Test'); // 400x300 Standardraum
  room.items.push({ id: 1, name: 'Sofa', w: 50, d: 50, x: -30, y: 100, rot: 0, doors: 0, color: {}, locked: false });
  room.nextId = 2;
  const v2 = ctx.addVariant(room); // dupliziert aktive Variante inkl. des Möbelstücks
  v2.items.push({ id: 2, name: 'Stuhl', w: 40, d: 40, x: 450, y: 50, rot: 0, doors: 0, color: {}, locked: false });

  // Raum schrumpfen: neue, kleinere Rechteckform
  room.shape = ctx.rebuildRectShape(200, 150, room.shape);

  const changed = ctx.repositionItemsAfterShapeChange(room);
  assert.equal(changed, true);

  room.variants.forEach(function(v) {
    v.items.forEach(function(item) {
      assert.equal(
        ctx.itemFitsInShape(item, room.shape), true,
        'Möbelstück "' + item.name + '" in Variante "' + v.name + '" muss nach der Korrektur innerhalb der neuen Raumform liegen'
      );
    });
  });
});
