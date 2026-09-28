'use strict';

// Undo/Redo (Aufgabe B): Regressionstest für einen Off-by-One-Fehler im
// Snapshot-Stack - saveStoreNow() wird immer NACH einer Mutation
// aufgerufen, ein naiver "Snapshot des aktuellen store" landet deshalb
// bereits als Post-Aktion-Zustand auf dem Undo-Stack. Der erste Undo-Klick
// bewirkte dadurch sichtbar nichts (er schrieb denselben Zustand zurück),
// erst der zweite Klick machte die zuletzt abgeschlossene Aktion rückgängig.
// _lastSnapshot in js/undo.js behebt das, indem stets der Zustand VOR der
// nächsten Aktion vorgehalten und gepusht wird.
//
// Deckt außerdem den Undo-Fix fürs Löschen ab (Möbel und Öffnungen riefen
// bislang kein saveStoreNow() auf - ein Löschen landete dadurch nicht
// zuverlässig auf dem Undo-Stack).

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./helpers/load-scripts');

function makeCtx() {
  const ctx = loadScripts(['constants.js', 'storage.js', 'migration.js', 'geometry.js', 'store.js', 'undo.js']);
  // undoApply() baut normalerweise die UI neu auf (fullRefresh/renderLandingProjects) -
  // im DOM-losen Testkontext genügt ein No-op, die Store-Wiederherstellung selbst
  // (worum es hier geht) läuft unabhängig davon.
  ctx.fullRefresh = function() {};
  ctx.renderLandingProjects = function() {};
  return ctx;
}

test('undo() macht die zuletzt abgeschlossene Aktion bereits beim ERSTEN Klick rückgängig', () => {
  const ctx = makeCtx();
  const room = ctx.currentRoom();
  const item = { id: room.nextId++, name: 'Sofa', w: 160, d: 80, x: 60, y: 60, rot: 0, color: '#4C8BF5', locked: false };
  room.items.push(item);
  ctx.saveStoreNow(); // Baseline: Möbel angelegt

  item.rot = 90;
  ctx.saveStoreNow(); // Aktion 1
  item.rot = 180;
  ctx.saveStoreNow(); // Aktion 2

  ctx.undo();
  assert.equal(ctx.currentRoom().items[0].rot, 90, 'erster Undo-Klick muss Aktion 2 (rot=180) bereits rückgängig machen');

  ctx.undo();
  assert.equal(ctx.currentRoom().items[0].rot, 0, 'zweiter Undo-Klick macht Aktion 1 (rot=90) rückgängig');
});

test('redo() stellt nach zwei Undo-Klicks die Aktionen wieder her', () => {
  const ctx = makeCtx();
  const room = ctx.currentRoom();
  const item = { id: room.nextId++, name: 'Sofa', w: 160, d: 80, x: 60, y: 60, rot: 0, color: '#4C8BF5', locked: false };
  room.items.push(item);
  ctx.saveStoreNow();
  item.rot = 90;
  ctx.saveStoreNow();
  item.rot = 180;
  ctx.saveStoreNow();

  ctx.undo();
  ctx.undo();
  assert.equal(ctx.currentRoom().items[0].rot, 0);

  ctx.redo();
  assert.equal(ctx.currentRoom().items[0].rot, 90, 'erstes Redo stellt Aktion 1 wieder her');
  ctx.redo();
  assert.equal(ctx.currentRoom().items[0].rot, 180, 'zweites Redo stellt Aktion 2 wieder her');
});

test('Möbel-Löschen landet auf dem Undo-Stack und lässt sich rückgängig machen', () => {
  const ctx = makeCtx();
  const room = ctx.currentRoom();
  const item = { id: room.nextId++, name: 'Sofa', w: 160, d: 80, x: 60, y: 60, rot: 0, color: '#4C8BF5', locked: false };
  room.items.push(item);
  ctx.saveStoreNow(); // Baseline mit Möbel

  // Entspricht dem "delete"-Zweig in handleToolClick (js/interaction.js)
  room.items = room.items.filter(function(i) { return i.id !== item.id; });
  ctx.saveStoreNow();

  assert.equal(ctx.currentRoom().items.length, 0);
  ctx.undo();
  assert.equal(ctx.currentRoom().items.length, 1, 'Undo muss das gelöschte Möbelstück wiederherstellen');
  assert.equal(ctx.currentRoom().items[0].name, 'Sofa');
});

test('Öffnungs-Löschen landet auf dem Undo-Stack und lässt sich rückgängig machen', () => {
  const ctx = makeCtx();
  const room = ctx.currentRoom();
  const wallId = room.shape.wallIds[0];
  const opening = { id: room.nextOpeningId++, wallId, type: 'door', width: 90, pos: 20, hingeAtStart: true, locked: false };
  room.openings.push(opening);
  ctx.saveStoreNow(); // Baseline mit Öffnung

  // Entspricht dem "delete"-Zweig in handleOpeningToolClick (js/interaction.js)
  room.openings = room.openings.filter(function(o) { return o.id !== opening.id; });
  ctx.saveStoreNow();

  assert.equal(ctx.currentRoom().openings.length, 0);
  ctx.undo();
  assert.equal(ctx.currentRoom().openings.length, 1, 'Undo muss die gelöschte Öffnung wiederherstellen');
  assert.equal(ctx.currentRoom().openings[0].type, 'door');
});

test('Öffnungs-Sperren (locked) lässt sich per Undo zurücknehmen', () => {
  const ctx = makeCtx();
  const room = ctx.currentRoom();
  const wallId = room.shape.wallIds[0];
  const opening = { id: room.nextOpeningId++, wallId, type: 'door', width: 90, pos: 20, hingeAtStart: true, locked: false };
  room.openings.push(opening);
  ctx.saveStoreNow();

  opening.locked = true;
  ctx.saveStoreNow();
  assert.equal(ctx.currentRoom().openings[0].locked, true);

  ctx.undo();
  assert.equal(ctx.currentRoom().openings[0].locked, false, 'Undo muss den Sperrstatus zurücknehmen');
});

test('Öffnungen ohne locked-Feld (alte Datenstände) gelten als entsperrt', () => {
  const ctx = makeCtx();
  const room = ctx.currentRoom();
  const wallId = room.shape.wallIds[0];
  // Simuliert einen alten Datenstand: kein locked-Feld gesetzt (keine
  // Migration nötig, analog zum bestehenden item.locked bei Möbeln).
  const legacyOpening = { id: room.nextOpeningId++, wallId, type: 'door', width: 90, pos: 20, hingeAtStart: true };
  room.openings.push(legacyOpening);
  assert.equal(!!ctx.currentRoom().openings[0].locked, false);
});
