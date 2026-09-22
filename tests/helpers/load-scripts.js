'use strict';

// Lädt eine oder mehrere der klassischen js/*.js-Dateien (Browser-<script>,
// kein Modulsystem) in einen isolierten vm-Kontext und gibt diesen Kontext
// zurück. Die darin per `function name() {}` bzw. `const/let` definierten
// Top-Level-Bezeichner sind danach als Eigenschaften des zurückgegebenen
// Objekts nutzbar, z.B. ctx.shapeFromRect(...).
//
// Enthält nur minimale Stubs für document/localStorage, damit Dateien, die
// diese beiläufig referenzieren, sich laden lassen. Für Tests, die echtes
// DOM-Verhalten brauchen, ist dieser Loader nicht gedacht.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS_DIR = path.join(__dirname, '..', '..', 'js');

function makeStubDocument() {
  const stubElement = () => ({
    style: {},
    dataset: {},
    setAttribute() {},
    getAttribute() { return null; },
    appendChild() {},
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
  });
  return {
    getElementById() { return stubElement(); },
    querySelector() { return stubElement(); },
    querySelectorAll() { return []; },
    createElement() { return stubElement(); },
    body: stubElement(),
    addEventListener() {},
    removeEventListener() {}
  };
}

function makeStubLocalStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

/**
 * @param {string[]} files Dateinamen relativ zu js/, in Ladereihenfolge (z.B. ['constants.js', 'geometry.js'])
 * @returns {vm.Context} Kontext mit den geladenen Top-Level-Bezeichnern
 */
function loadScripts(files) {
  const sandbox = {
    console,
    document: makeStubDocument(),
    localStorage: makeStubLocalStorage(),
    window: undefined,
    navigator: { userAgent: 'node' }
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);

  for (const file of files) {
    const fullPath = path.join(JS_DIR, file);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, context, { filename: fullPath });
  }

  return context;
}

module.exports = { loadScripts };
