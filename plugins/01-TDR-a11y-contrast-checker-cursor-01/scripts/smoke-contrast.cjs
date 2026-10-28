const assert = require('node:assert/strict');
const c = require('../.tmp-contrast.cjs');

assert.equal(c.normalizeHex('#abc'), '#AABBCC');
assert.equal(c.rgbToHex({ r: 1, g: 0, b: 0 }), '#FF0000');

const blackWhite = c.contrastRatio({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 });
assert.ok(Math.abs(blackWhite - 21) < 0.01, `expected ~21, got ${blackWhite}`);

const translucent = c.contrastRatioWithOpacity(
  { r: 0, g: 0, b: 0 },
  { r: 1, g: 1, b: 1 },
  0.5,
);
assert.ok(translucent < blackWhite, 'translucent black over white must be weaker than opaque');

const results = c.evaluateWcag(blackWhite);
assert.equal(results.every((r) => r.pass), true);

console.log('smoke-contrast: ok');
