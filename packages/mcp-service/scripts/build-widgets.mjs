// Builds the card into one HTML document, with its script and its styles inside: a host
// frames it without a server of ours behind it, so nothing may be left to fetch.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const watch = process.argv.includes('--watch')

const documentOf = (script, styles) =>
  [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<meta name="color-scheme" content="light dark" />',
    `<style>${styles}</style>`,
    '</head>',
    '<body>',
    '<div id="root"></div>',
    // A closing tag inside the script would end it early.
    `<script type="module">${script.replaceAll('</script', '<\\/script')}</script>`,
    '</body>',
    '</html>',
  ].join('\n')

const targets = [
  { entry: 'widgets/src/main.tsx', styles: 'widgets/src/styles.css', out: 'dist/widget.html' },
  {
    entry: 'widgets/workbench/main.ts',
    styles: 'widgets/workbench/styles.css',
    out: 'dist/workbench.html',
  },
]

const write = async ({ styles, out }, result) => {
  const script = result.outputFiles[0].text
  const css = await esbuild.transform(await readFile(resolve(root, styles), 'utf8'), {
    loader: 'css',
    minify: true,
  })
  const file = resolve(root, out)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, documentOf(script, css.code.trim()))
  console.log(`${out} ${(Buffer.byteLength(script) / 1024).toFixed(1)} kB of script`)
}

const optionsOf = target => ({
  entryPoints: [resolve(root, target.entry)],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  write: false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  legalComments: 'none',
  // Each entry imports its stylesheet so that a change to it is watched; the styles
  // themselves are written into the document by `write`.
  loader: { '.css': 'empty' },
  plugins: watch
    ? [
        {
          name: 'write-document',
          setup(build) {
            build.onEnd(result => {
              if (result.errors.length === 0) return write(target, result)
            })
          },
        },
      ]
    : [],
})

if (watch) {
  for (const target of targets) {
    const context = await esbuild.context(optionsOf(target))
    await context.watch()
  }
} else {
  for (const target of targets) await write(target, await esbuild.build(optionsOf(target)))
}
