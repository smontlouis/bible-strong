const fs = require('fs')
const bundle = fs.readFileSync('./dist/index.html', 'utf8')

const escaped = JSON.stringify(bundle)
const js = `export default ${escaped}`

fs.writeFileSync('studiesHTML.ts', js)
