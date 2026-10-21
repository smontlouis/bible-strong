// Reports which functions React Compiler compiles in each file given, and why it skips others.
// Usage (from apps/expo): node ../../.argent/perf/react-compiler-check.cjs <file.tsx> [...]
const babel = require(require.resolve('@babel/core', { paths: [process.cwd()] }))
const fs = require('fs')

for (const file of process.argv.slice(2)) {
  const events = []
  babel.transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [
      [
        require.resolve('@babel/preset-typescript', { paths: [process.cwd()] }),
        { isTSX: true, allExtensions: true },
      ],
    ],
    plugins: [
      [
        require.resolve('babel-plugin-react-compiler', { paths: [process.cwd()] }),
        { logger: { logEvent: (_filename, event) => events.push(event) } },
      ],
    ],
  })
  console.log('==', file)
  const compiled = events.filter(e => e.kind === 'CompileSuccess').map(e => e.fnName)
  console.log('  compiled:', compiled.join(', ') || '-')
  for (const e of events) {
    if (!['CompileError', 'PipelineError', 'CompileDiagnostic'].includes(e.kind)) continue
    const d = e.detail || {}
    const reason = d.reason || d.options?.reason || d.message || JSON.stringify(d).slice(0, 200)
    const loc = (d.loc || d.options?.loc || e.fnLoc || {}).start
    console.log(`  ${e.kind}: ${String(reason).slice(0, 220)}${loc ? ` (line ${loc.line})` : ''}`)
  }
}
