// Native, DOM and image-based consumers share the same resource icon geometry.
// Run after editing src/common/icons/resource-icon-shapes.json.
const fs = require('node:fs')
const path = require('node:path')
const shapes = require('../src/common/icons/resource-icon-shapes.json')
const scriptDir = path.dirname(require.main.filename)
const files = {
  strong: 'lexique',
  references: 'references',
  dictionary: 'dictionary',
  nave: 'nave',
  commentary: 'comment',
}
for (const [kind, file] of Object.entries(files)) {
  const symbol = shapes.symbols[kind]
  const frame = Object.entries(shapes.frame)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')
  const transform = symbol.transform ? ` transform="${symbol.transform}"` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="${shapes.viewBox}" fill="none"><rect ${frame} stroke="#000" stroke-width="2"/><path d="${symbol.path}"${transform} fill="#000"/></svg>\n`
  fs.writeFileSync(path.join(scriptDir, '../src/assets/images/tab-icons', `${file}.svg`), svg)
}
