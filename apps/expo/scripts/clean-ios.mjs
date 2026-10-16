// Removes what an iOS dev build leaves on disk for this app: the prebuild output
// (ios/, with its Pods) and the app's Xcode DerivedData. Both are rebuilt by
// `expo prebuild` and the next `expo run:ios`. Shared Xcode data (simulators,
// runtimes, other projects' DerivedData, CocoaPods cache) is left alone.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const derivedDataRoot = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData')

// Xcode names the folder <project>-<hash>; the project is devBibleStrong,
// stagingBibleStrong or BibleStrong depending on the variant.
const derivedData = fs.existsSync(derivedDataRoot)
  ? fs
      .readdirSync(derivedDataRoot)
      .filter(name => /^(dev|staging)?BibleStrong-[a-z]+$/i.test(name))
      .map(name => path.join(derivedDataRoot, name))
  : []

const targets = [path.join(appRoot, 'ios'), ...derivedData].filter(target => fs.existsSync(target))

if (targets.length === 0) {
  console.log('Nothing to clean.')
  process.exit(0)
}

for (const target of targets) {
  const size = execFileSync('du', ['-sh', target], { encoding: 'utf8' }).split('\t')[0]
  fs.rmSync(target, { recursive: true, force: true })
  console.log(`Removed ${target} (${size.trim()})`)
}
