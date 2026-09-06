/* global __dirname */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const appRoot = path.resolve(__dirname, '..')
function load(name) {
  const f = path.join(appRoot, 'src/themes', name + '.ts')
  const code = ts.transpileModule(fs.readFileSync(f, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: dep => ({ default: load(dep.replace('./', '')) }) })
  return exports.default
}
const palettes = { light: load('colors'), default: load('colors') }
for (const n of ['dark', 'sepia', 'nature', 'sunset', 'black', 'mauve', 'night'])
  palettes[n] = load(n + 'Colors')
let css =
  "@import 'tailwindcss/theme.css' layer(theme);\n@import 'tailwindcss/utilities.css' layer(utilities);\n@import 'uniwind';\n\n/* Preserve React Native Web defaults: intentionally omit Tailwind Preflight. */\n@theme {\n  --spacing: 4px;\n}\n\n@layer theme {\n  :root {\n"
for (const [name, p] of Object.entries(palettes)) {
  css += `    @variant ${name} {\n`
  for (const [k, v] of Object.entries(p))
    css += `      --color-${k.replace(/[A-Z]/g, x => '-' + x.toLowerCase())}: ${v};\n`
  css += `      --color-background: ${p.reverse};\n      --color-foreground: ${p.default};\n    }\n`
}
css += '  }\n}\n'
const destination = path.join(appRoot, 'global.css')
if (process.argv.includes('--check')) {
  if (fs.readFileSync(destination, 'utf8') !== css)
    throw new Error('Theme CSS is stale. Run yarn workspace @bible-strong/expo themes:generate')
} else {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== css)
    fs.writeFileSync(destination, css)
}
