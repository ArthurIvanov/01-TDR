/**
 * Figma serves ui.html as a blob URL — external <script src="ui.js"> never loads.
 * Inline the bundled UI into ui.html for the plugin runtime.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const templatePath = path.join(root, 'ui.template.html');
const bundlePath = path.join(root, 'ui.js');
const outPath = path.join(root, 'ui.html');

const template = fs.readFileSync(templatePath, 'utf8');
const bundle = fs.readFileSync(bundlePath, 'utf8');
const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');

if (!template.includes('<script src="ui.js"></script>')) {
  console.error('ui.template.html must contain: <script src="ui.js"></script>');
  process.exit(1);
}

const html = template.replace(
  '<script src="ui.js"></script>',
  `<script>\n${safeBundle}\n</script>`,
);

fs.writeFileSync(outPath, html);
console.log(`inline-ui: wrote ${path.basename(outPath)} (${html.length} bytes)`);
