'use strict';

// Beispieltest: zeigt, dass das Test-Setup funktioniert (Datei laden,
// Funktion aufrufen, assert). Kein Anspruch auf Abdeckung der in der
// CLAUDE.md genannten Testprioritäten - das folgt in eigenen Tasks.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-scripts');

// Hinweis: Objekte/Arrays, die im vm-Kontext erzeugt werden, gehören zu
// einem anderen Realm als die Testdatei. assert.deepEqual/deepStrictEqual
// vergleicht dann auch Prototypen und schlägt fälschlich fehl - deshalb
// hier gezielt auf Primitives (Array.from, einzelne Felder) prüfen statt
// ganze Objekte/Arrays 1:1 zu vergleichen.

test('shapeFromRect erzeugt ein Rechteck mit 4 Ecken und 4 Wand-IDs', () => {
  const ctx = loadScripts(['constants.js', 'geometry.js']);
  const shape = ctx.shapeFromRect(400, 300);

  assert.equal(shape.vertices.length, 4);
  assert.deepEqual(Array.from(shape.wallIds), [1, 2, 3, 4]);
  assert.equal(shape.vertices[2].x, 400);
  assert.equal(shape.vertices[2].y, 300);
});

test('rebuildRectShape behaelt vorhandene Wand-IDs bei Maßänderung', () => {
  const ctx = loadScripts(['constants.js', 'geometry.js']);
  const existing = { vertices: [], wallIds: [7, 8, 9, 10] };

  const shape = ctx.rebuildRectShape(500, 350, existing);

  assert.deepEqual(Array.from(shape.wallIds), [7, 8, 9, 10]);
  assert.equal(shape.vertices[2].x, 500);
  assert.equal(shape.vertices[2].y, 350);
});
