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
  const app = read('app.js');
  const sansFontPath = path.join(__dirname, '..', 'assets/fonts/moltch-sans-regular.ttf');
  const monoFontPath = path.join(__dirname, '..', 'assets/fonts/moltch-mono-regular.ttf');

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

  assert.ok(css.includes('@font-face'), 'theme should declare self-hosted font faces');
  assert.ok(css.includes('font-display: swap'), 'managed fonts should use swap rendering');
  assert.ok(css.includes('moltch-sans-regular.ttf'), 'theme should reference managed sans font asset');
  assert.ok(css.includes('moltch-mono-regular.ttf'), 'theme should reference managed mono font asset');
  assert.ok(fs.existsSync(sansFontPath), 'managed sans font asset should exist');
  assert.ok(fs.existsSync(monoFontPath), 'managed mono font asset should exist');
  assert.ok(!css.includes('@import url('), 'theme should not rely on remote font import');
  assert.ok(html.includes('rel="preload" href="/assets/fonts/moltch-sans-regular.ttf"'), 'index should preload managed sans font');
  assert.ok(html.includes('rel="preload" href="/assets/fonts/moltch-mono-regular.ttf"'), 'index should preload managed mono font');
  assert.ok(html.includes('theme-proof-note'), 'index should expose a proof surface note');
  assert.ok(docs.includes('verdict colors are reserved for real `go` / `hold` / `no-go` semantics only'));
  assert.ok(docs.includes('keep pre-selection or pending workflow labels on neutral styling'));
  assert.ok(app.includes(": 'badge-neutral';"), 'pending workflow badge should stay neutral');

  console.log('[asset-pack][pass] governed theme tokens, managed fonts, and verdict fencing are present');
}

run();
