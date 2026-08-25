#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const git = args => {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    process.stderr.write(result.stderr)
    process.exit(result.status ?? 1)
  }
  return result.stdout
}

const baseline = JSON.parse(
  readFileSync(new URL('./agents-style-baseline.json', import.meta.url), 'utf8')
)
const exceptionPattern = /^\s*\/\/\s*harness-allow-styled:\s+\S/
const emotionImportPattern = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]@emotion\/native['"]/g

const getEmotionStyledAliases = source => {
  const aliases = []
  for (const match of source.matchAll(emotionImportPattern)) {
    aliases.push(match[1])
  }
  return aliases
}

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
  .filter(file => file.startsWith('apps/mobile/src/'))

const findings = []
const staleBaselineEntries = []
const currentCounts = new Map()

for (const file of sourceFiles) {
  if (file.startsWith('apps/mobile/src/common/ui/') || !existsSync(file)) continue

  const lines = readFileSync(file, 'utf8').split('\n')
  if (lines.some(line => exceptionPattern.test(line))) {
    currentCounts.set(file, baseline[file] ?? 0)
    continue
  }

  const aliases = getEmotionStyledAliases(lines.join('\n'))
  const styledLines =
    aliases.length === 0
      ? []
      : lines
          .map((text, index) => ({ line: index + 1, text }))
          .filter(({ text }) => aliases.some(alias => new RegExp(`\\b${alias}\\b`).test(text)))
  const allowedCount = baseline[file] ?? 0
  currentCounts.set(file, styledLines.length)

  if (styledLines.length > allowedCount) {
    findings.push(
      ...styledLines.slice(allowedCount).map(({ line, text }) => ({
        file,
        line,
        text: text.trim(),
      }))
    )
  }
}

for (const [file, allowedCount] of Object.entries(baseline)) {
  const currentCount = currentCounts.get(file) ?? 0
  if (currentCount < allowedCount) {
    staleBaselineEntries.push({ file, allowedCount, currentCount })
  }
}

if (staleBaselineEntries.length > 0) {
  console.error('The styled brownfield baseline must decrease with the code:')
  for (const { file, allowedCount, currentCount } of staleBaselineEntries) {
    console.error(`- ${file}  baseline: ${allowedCount}, current: ${currentCount}`)
  }
  console.error(
    '\nLower or remove these entries in scripts/agents-style-baseline.json in the same change.'
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error('New styled usage is not allowed in feature code:')
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}  ${finding.text}`)
  }
  console.error(
    '\nUse ~common/ui primitives (Box, HStack, VStack, Text, etc.). ' +
      'For a genuine primitive gap, add a shared primitive under apps/mobile/src/common/ui/.'
  )
  console.error(
    'Rare feature-level exceptions require `// harness-allow-styled: <reason>` in the same file.'
  )
  process.exit(1)
}

console.log('No styled usage exceeds the versioned brownfield baseline.')
