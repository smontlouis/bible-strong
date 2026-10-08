import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import ts from 'typescript'

const packageRoot = path.resolve(__dirname, '../../..')
const entry = path.join(packageRoot, 'src/runtime/worker.ts')

type ModuleImports = { static: string[]; dynamic: string[] }

// Imports that survive compilation: `import type` and `export type` are erased.
const importsOf = (file: string): ModuleImports => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true)
  const imports: ModuleImports = { static: [], dynamic: [] }
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      const bindings = clause?.namedBindings
      const erased =
        clause?.isTypeOnly ||
        (clause &&
          !clause.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every(element => element.isTypeOnly))
      if (!erased) imports.static.push(statement.moduleSpecifier.text)
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      !statement.isTypeOnly
    ) {
      imports.static.push(statement.moduleSpecifier.text)
    }
  }
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.dynamic.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}

const resolveLocal = (from: string, specifier: string): string | undefined => {
  if (specifier.startsWith('.')) {
    const target = path.resolve(path.dirname(from), specifier)
    return [target, `${target}.ts`, path.join(target, 'index.ts')].find(
      candidate => existsSync(candidate) && /\.(?:ts|json)$/.test(candidate)
    )
  }
  // A workspace package is source too: follow it through its `exports`.
  const workspace = specifier.match(/^(@bible-strong\/[^/]+)(\/.+)?$/)
  if (!workspace) return undefined
  const root = path.join(packageRoot, 'node_modules', workspace[1])
  const exports = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).exports
  return path.join(root, exports[workspace[2] ? `.${workspace[2]}` : '.'])
}

const startupGraph = () => {
  const files = new Set<string>()
  const packages = new Set<string>()
  const pending = [entry]
  for (let file = pending.pop(); file; file = pending.pop()) {
    if (files.has(file) || file.endsWith('.json')) continue
    files.add(file)
    for (const specifier of importsOf(file).static) {
      const local = resolveLocal(file, specifier)
      if (local) pending.push(local)
      else packages.add(specifier)
    }
  }
  return {
    files: [...files].map(file => path.relative(packageRoot, file)),
    packages: [...packages].sort(),
  }
}

describe('Resource Worker start-up', () => {
  // Cloudflare evaluates the entry module and everything it imports statically each time it
  // starts an isolate, before the first request and whatever that request is. Effect, the
  // HTTP application, Kysely, pg and the search modules took four fifths of that time while
  // a cached answer, a preflight and a health check need none of them.
  it('starts without Effect, the HTTP application, the database client and search', () => {
    const { files, packages } = startupGraph()

    // `jose` verifies the attestation of plain Offline copies and costs nothing measurable.
    assert.deepEqual(packages, ['jose'])
    for (const file of files) {
      assert.doesNotMatch(
        file,
        /^src\/(?:domain|repositories|database|analytics)\/|^src\/http\/(?:app|api|problems)\.ts$|^src\/runtime\/(?:resourceOrigin|searchAnalyticsEngine)\.ts$/,
        `${file} is loaded when the Worker starts`
      )
    }
  })

  it('loads the HTTP application and the database client only on demand', () => {
    assert.deepEqual(importsOf(entry).dynamic, ['./resourceOrigin'])
    const origin = importsOf(path.join(packageRoot, 'src/runtime/resourceOrigin.ts')).static
    assert.equal(origin.includes('../http/app'), true)
    assert.equal(origin.includes('../database/hyperdriveDatabase'), true)
  })
})
