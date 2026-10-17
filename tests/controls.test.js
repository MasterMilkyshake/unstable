import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIND, CONTROLS } from '../src/core/input.js';
import { controlsMarkdown } from '../tools/controls-table.mjs';

const isKey = (k) => k === 'hotbar' || k.startsWith('mouse:') || k in BIND;

test('every binding is in the controls table, and the table names only bindings', () => {
  const used = new Set(CONTROLS.flatMap((r) => r.keys));
  for (const action of Object.keys(BIND)) assert.ok(used.has(action), `${action} (${BIND[action]}) is missing from CONTROLS`);
  for (const r of CONTROLS) {
    for (const k of r.keys) assert.ok(isKey(k), `${k} is not a binding`);
    for (const [, a] of r.text.matchAll(/\{([a-z]+)(?::\d)?\}/g)) assert.ok(isKey(a), `{${a}} in "${r.text}" is not a binding`);
  }
});

test("README's controls table is the controls table", () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const at = readme.indexOf('## Controls');
  assert.ok(at >= 0, 'README has a Controls section');
  const table = readme.slice(at).split('\n').filter((l) => l.startsWith('|')).join('\n');
  assert.equal(table, controlsMarkdown(), 'run node tools/controls-table.mjs and paste its table into README');
});

test('every key a prompt names in brackets is a key the game binds', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const { keyLabel, SLOT_KEYS } = await import('../src/core/input.js');
  const labels = new Set([...Object.values(BIND).flat().map(keyLabel), ...SLOT_KEYS.map(keyLabel), 'LMB', 'RMB']);
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = `${dir}/${f}`;
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js')) files.push(p);
    }
  };
  walk(new URL('../src', import.meta.url).pathname);
  const bad = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    // a key in a prompt follows a space, a quote or punctuation (code like PAL[V] does not)
    for (const [, k] of text.matchAll(/(?<=[\s('"`·])\[(Space|Tab|Shift|Esc|Ctrl|LMB|RMB|[A-Z]|[0-9])\]/g)) if (!labels.has(k)) bad.push(`${f.split('/src/')[1]}: [${k}]`);
  }
  assert.deepEqual(bad, []);
});

test('tips and Guide entries name keys only through bindings', async () => {
  const { TIPS } = await import('../src/data/tips.js');
  const { GUIDE } = await import('../src/ui/guide.js');
  const fields = new Set(['who', 'need', 'lives', 'max', 'from']); // filled in when a tip shows
  const texts = [...Object.values(TIPS).flatMap((t) => [t.text, t.guide].filter(Boolean)), ...GUIDE.map((g) => g.x)];
  // the Guide's copy of a tip has no runtime fields left in it
  for (const t of Object.values(TIPS)) assert.ok(!/\{(who|need|lives|max|from)\}/.test(t.guide || t.text), `${t.title} needs a guide text`);
  for (const text of texts) {
    for (const [, a] of text.matchAll(/\{([a-zA-Z]+)(?::[^}]*)?\}/g)) assert.ok(a === 'mouse' || a === 'hotbar' || a in BIND || fields.has(a), `{${a}} in "${text.slice(0, 60)}…"`);
    assert.ok(!/\[(Space|Tab|Shift|[A-Z])\]/.test(text), `a literal key in "${text.slice(0, 60)}…": use {action}`);
  }
  for (const g of GUIDE) if (g.k) assert.ok(g.k in BIND, g.k);
});
