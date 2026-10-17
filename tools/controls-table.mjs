// README's controls table, written from CONTROLS (core/input.js): paste it under "## Controls".
// tests/controls.test.js fails when README's table and CONTROLS disagree.
//   node tools/controls-table.mjs
import { CONTROLS, controlKeys, controlText } from '../src/core/input.js';

// a key that is itself a backtick needs a double-backtick code span
const code = (k) => (k.includes('`') ? '`` ' + k + ' ``' : '`' + k + '`');
export function controlsMarkdown() {
  const rows = CONTROLS.map((r) => `| ${controlKeys(r).map(code).join(' + ')} | ${controlText(r, code)} |`);
  return ['| Key | Action |', '| --- | --- |', ...rows].join('\n');
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(controlsMarkdown());
