const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function run() {
  const css = read('styles.css');
  const html = read('index.html');
  const docs = read('THEME_REFERENCE.md');

  const requiredCssTokens = [
    '--color-policy-cyan',
    '--color-agent-violet',
    '--color-verdict-go',
    '--color-verdict-hold',
    '--color-verdict-nogo'
  ];

  for (const token of requiredCssTokens) {
    assert.ok(css.includes(token), `missing token ${token}`);
  }

  const requiredPrimitives = [
    '.card',
    '.badge',
    '.mono-label',
    '.input',
    '.btn',
    '.trace-chip'
  ];

  for (const primitive of requiredPrimitives) {
    assert.ok(css.includes(primitive), `missing primitive ${primitive}`);
  }

  assert.ok(!css.includes('@import url('), 'theme should not rely on remote font import');
  assert.ok(html.includes('theme-proof-note'), 'index should expose a proof surface note');
  assert.ok(docs.includes('verdict colors are reserved for real `go` / `hold` / `no-go` semantics only'));

  console.log('[asset-pack][pass] governed theme tokens and proof surface are present');
}

run();
