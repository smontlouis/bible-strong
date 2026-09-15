import { transformFileSync } from '@babel/core'
import path from 'node:path'

// A compiler bailout on either screen repeats search work and closed-sheet renders
// for every keypress. Exercise the actual components, not a reduced syntax fixture.
it.each([
  'SearchTabScreen.tsx',
  'SQLiteSearchScreen.tsx',
  'SearchQueryInput.tsx',
  'usePersonalSearchResults.ts',
])('keeps %s optimized', component => {
  const failures: unknown[] = []
  const result = transformFileSync(path.join(__dirname, '..', component), {
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
    plugins: [
      [
        'babel-plugin-react-compiler',
        {
          logger: {
            logEvent: (_filename: string, event: { kind: string }) => {
              if (event.kind === 'CompileError') failures.push(event)
            },
          },
        },
      ],
    ],
  })

  expect(failures).toEqual([])
  expect(result?.code).toContain('react/compiler-runtime')
})
