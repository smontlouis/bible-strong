#!/usr/bin/env node

// Keeps the Expo app on its surface rules (design-system/project/README.md, "The app"):
// corner radii from one scale, one shared shadow for what floats, and a page that uses the canvas
// gives it to its root container. Existing departures are frozen per file in
// agents-surface-baseline.json and may only go down.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const baselineUrl = new URL('./agents-surface-baseline.json', import.meta.url)
const allowedRadii = new Set([0, 4, 8, 12, 16, 24, 999])
const exceptionPattern = /^\s*\/\/\s*surface-allow:\s+\S/
const sharedSurfacesFile = 'apps/expo/src/common/ui/surfaces.ts'
// The playground is a developer screen, not a surface users see: its mock-ups stay out of the rules.
const playgroundDir = 'apps/expo/src/features/playground/'

const classRadiusPattern = /\brounded(?:-[tblrsexy]{1,2})?-\[(\d+(?:\.\d+)?)px\]/g
const styleRadiusPattern =
  /\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius:\s*(\d+(?:\.\d+)?)\b/g
const shadowPattern = /\bshadowColor\s*:|\belevation\s*:\s*\d|\bshadow-\[|\bboxShadow\s*:/g
const canvasPattern = /\bbg-canvas\b|backgroundColor="canvas"|\bbg="canvas"|\bcolors\.canvas\b/
const rootWrapperPattern = /<(FormSheetScreen|Container|SafeAreaBox)\b([^>]*)>/g
const kinds = ['radius', 'shadow', 'ground']

const git = args => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
  return result.stdout
}

// Paths below are relative to the repository root, wherever the script is started from.
process.chdir(git(['rev-parse', '--show-toplevel']).trim())

const sourceFiles = git([
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '--',
  '*.ts',
  '*.tsx',
])
  .split('\n')
  .filter(
    file =>
      file.startsWith('apps/expo/src/') &&
      !file.includes('/__tests__/') &&
      !file.startsWith(playgroundDir) &&
      file !== sharedSurfacesFile &&
      existsSync(file)
  )

const countFile = file => {
  const source = readFileSync(file, 'utf8')
  const lines = source.split('\n')
  if (lines.some(line => exceptionPattern.test(line))) return null
  const found = { radius: [], shadow: [], ground: [] }
  // A root wrapper left on the white default while the page inside is on the canvas shows a white
  // status bar and a white band above the tab bar.
  if (canvasPattern.test(source)) {
    for (const match of source.matchAll(rootWrapperPattern)) {
      if (/\bbg-canvas\b/.test(match[2])) continue
      const line = source.slice(0, match.index).split('\n').length
      found.ground.push({ line, text: lines[line - 1] })
    }
  }
  lines.forEach((text, index) => {
    for (const pattern of [classRadiusPattern, styleRadiusPattern]) {
      for (const match of text.matchAll(pattern)) {
        if (!allowedRadii.has(Number(match[1]))) found.radius.push({ line: index + 1, text })
      }
    }
    for (const _ of text.matchAll(shadowPattern)) found.shadow.push({ line: index + 1, text })
  })
  return found
}

const baseline = existsSync(baselineUrl) ? JSON.parse(readFileSync(baselineUrl, 'utf8')) : {}
const current = {}
const increases = []

for (const file of sourceFiles) {
  const found = countFile(file)
  if (!found) continue
  const counts = Object.fromEntries(kinds.map(kind => [kind, found[kind].length]))
  if (kinds.some(kind => counts[kind])) current[file] = counts
  for (const kind of kinds) {
    const allowed = baseline[file]?.[kind] ?? 0
    if (counts[kind] > allowed) increases.push({ file, kind, allowed, found: found[kind] })
  }
}

const stale = Object.entries(baseline).flatMap(([file, counts]) =>
  kinds.flatMap(kind => {
    const count = current[file]?.[kind] ?? 0
    return count < (counts[kind] ?? 0) ? [{ file, kind, allowed: counts[kind], count }] : []
  })
)

const sortedCurrent = Object.fromEntries(
  Object.entries(current).sort(([a], [b]) => a.localeCompare(b))
)

if (process.argv.includes('--update-baseline')) {
  if (increases.length > 0 && existsSync(baselineUrl)) {
    console.error('The baseline only goes down. Fix these before updating it:')
    for (const { file, kind, allowed, found } of increases)
      console.error(`- ${file}  ${kind}: ${found.length} (baseline ${allowed})`)
    process.exit(1)
  }
  writeFileSync(baselineUrl, JSON.stringify(sortedCurrent, null, 2) + '\n')
  console.log(`Surface baseline written: ${Object.keys(sortedCurrent).length} files.`)
  process.exit(0)
}

if (increases.length > 0) {
  console.error('New departures from the surface rules:')
  for (const { file, kind, allowed, found } of increases) {
    console.error(`- ${file}  ${kind}: ${found.length} (baseline ${allowed})`)
    for (const { line, text } of found) console.error(`    ${line}: ${text.trim()}`)
  }
  console.error(
    '\nRadii come from the scale 4, 8, 12, 16, 24 or rounded-full (see radii in ' +
      `${sharedSurfacesFile}). A shadow is only for what floats: use floatingShadow from the same file.`
  )
  console.error(
    'A page that uses the canvas gives it to its root Container, SafeAreaBox or FormSheetScreen ' +
      '(className="bg-canvas"), so the status bar and the space above the tab bar follow it.'
  )
  console.error(
    'A file with a genuine exception (the Bible DOM halo, a drawn illustration) states it with ' +
      '`// surface-allow: <reason>`.'
  )
  process.exit(1)
}

if (stale.length > 0) {
  console.error('The surface baseline must decrease with the code:')
  for (const { file, kind, allowed, count } of stale)
    console.error(`- ${file}  ${kind}  baseline: ${allowed}, current: ${count}`)
  console.error(
    '\nRun `node scripts/agents-surface-lint.mjs --update-baseline` in the same change.'
  )
  process.exit(1)
}

console.log('No surface departure exceeds the versioned baseline.')
