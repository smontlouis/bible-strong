import * as fs from 'fs'

const bundle = fs.readFileSync('./dist/index.html', 'utf8')

const escaped = JSON.stringify(bundle)
const js = `export default ${escaped}`

fs.writeFileSync('bibleHTML.ts', js)
