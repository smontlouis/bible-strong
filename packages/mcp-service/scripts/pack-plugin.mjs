// Packs the plugin as the ZIP the submission portal takes: the manifest, the server it
// connects to, the skills and the logo, at the root of the archive.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plugin = resolve(root, 'plugin')
const { name, version } = JSON.parse(readFileSync(resolve(plugin, 'plugin.json'), 'utf8'))
const archive = resolve(root, 'dist', `${name}-${version}.zip`)

mkdirSync(dirname(archive), { recursive: true })
rmSync(archive, { force: true })
// Finder leaves its own files in a folder it has shown: they are not part of the package.
execFileSync('zip', ['-r', '-X', archive, '.', '-x', '*.DS_Store'], { cwd: plugin, stdio: 'inherit' })
console.log(`\n${archive}`)
