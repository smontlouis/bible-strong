import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src')

// Load the real exported Firebase handlers without initializing credentials or
// connecting to a project. Only the SDK boundary is replaced.
function fixture(entries, initialFiles = []) {
  const documents = new Map(entries)
  const files = new Set(initialFiles)
  const fileFailures = new Set()
  const documentFailures = new Set()
  const fileAttempts = []
  const queries = []
  const removals = []
  const document = documentPath => ({
    path: documentPath,
    id: documentPath.split('/').at(-1),
    listCollections: async () => [...new Set([...documents.keys()]
      .filter(key => key.startsWith(`${documentPath}/`))
      .map(key => key.slice(0, documentPath.length + 1) + key.slice(documentPath.length + 1).split('/')[0]))]
      .map(collection),
    delete: async () => { documents.delete(documentPath) },
  })
  const collection = collectionPath => {
    const makeQuery = (filter, maximum = Infinity) => ({
      where: (field, operator, value) => {
        assert.equal(operator, '==')
        return makeQuery({ field, value }, maximum)
      },
      limit: count => makeQuery(filter, count),
      get: async () => {
        const matches = [...documents.entries()].filter(([key, data]) => {
          if (!key.startsWith(`${collectionPath}/`) || key.split('/').length !== collectionPath.split('/').length + 1) return false
          return !filter || filter.field.split('.').reduce((value, part) => value?.[part], data) === filter.value
        }).slice(0, maximum)
        queries.push({ collectionPath, filter, maximum, size: matches.length })
        return { empty: matches.length === 0, docs: matches.map(([key, data]) => ({ id: key.split('/').at(-1), ref: document(key), data: () => data })) }
      },
    })
    return { path: collectionPath, ...makeQuery(), doc: id => document(`${collectionPath}/${id}`) }
  }
  const db = {
    collection,
    batch: () => {
      const pending = []
      return {
        delete: ref => pending.push(ref.path),
        commit: async () => {
          assert.ok(pending.length <= 500)
          pending.forEach(key => documents.delete(key))
        },
      }
    },
    recursiveDelete: async ref => {
      if (documentFailures.has(ref.path)) throw new Error('firestore unavailable')
      removals.push(ref.path)
      for (const key of documents.keys()) {
        if (key === ref.path || key.startsWith(`${ref.path}/`)) documents.delete(key)
      }
    },
  }
  const bucket = {
    file: name => ({
      delete: async options => {
        fileAttempts.push(name)
        if (fileFailures.has(name)) throw new Error('storage unavailable')
        if (!files.has(name) && !options?.ignoreNotFound) throw Object.assign(new Error('not found'), { code: 404 })
        files.delete(name)
      },
    }),
  }
  const admin = { firestore: () => db, storage: () => ({ bucket: () => bucket }) }
  const wrap = options => handler => Object.assign(handler, { runtimeOptions: options })
  const functions = options => ({
    runWith: next => functions(next),
    auth: { user: () => ({ onCreate: wrap(options), onDelete: wrap(options) }) },
    firestore: { document: () => ({ onDelete: wrap(options), onUpdate: wrap(options) }) },
    https: { onRequest: wrap(options) },
  })
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText
    const moduleRequire = id => {
      if (id === 'firebase-admin') return admin
      if (id === 'firebase-functions/v1') return functions({})
      if (id === 'puppeteer-core' || id === '@sparticuz/chromium-min') return {}
      if (id === 'cors') return () => {}
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), `${id}.ts`))
      return require(id)
    }
    vm.runInNewContext('(function(require,module,exports){' + compiled + '\n})', { console: { log() {}, error() {} } }, { filename })(moduleRequire, module, module.exports)
    return module.exports
  }
  return { documents, files, fileFailures, documentFailures, fileAttempts, queries, removals, users: load(path.join(sourceRoot, 'users.ts')), studies: () => load(path.join(sourceRoot, 'studies.ts')) }
}

const imageNames = id => [`images/studies/${id}.jpg`, `images/studies/${id}-whatsapp.jpg`]

test('account deletion removes owned public and private studies, nested data and previews, preserving other accounts', async () => {
  const f = fixture([
    ['users/alice', { email: 'alice@example.test' }],
    ['users/alice/notes/note', { text: 'private' }],
    ['users/alice/notes/note/children/child', {}],
    ['users/bob', {}],
    ['users/bob/notes/note', {}],
    ['studies/public', { user: { id: 'alice' }, published: true, id: 'other' }],
    ['studies/private', { user: { id: 'alice' }, published: false }],
    ['studies/private/children/child', {}],
    ['studies/other', { user: { id: 'bob' }, published: true }],
  ], [...imageNames('public'), ...imageNames('private'), ...imageNames('other')])
  await f.users.deleteUser({ uid: 'alice' })
  assert.deepEqual([...f.documents.keys()].sort(), ['studies/other', 'users/bob', 'users/bob/notes/note'])
  assert.deepEqual([...f.files].sort(), imageNames('other').sort())
})

test('deletion handles more than one page and a repeated Auth event', async () => {
  const entries = Array.from({ length: 505 }, (_, i) => [`studies/study-${i}`, { user: { id: 'alice' }, published: i % 2 === 0 }])
  const f = fixture(entries)
  await f.users.deleteUser({ uid: 'alice' })
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
  assert.ok(f.queries.filter(query => query.collectionPath === 'studies' && query.size > 0).length > 1)
  assert.ok(f.queries.every(query => Number.isFinite(query.maximum)))
  assert.equal(f.users.deleteUser.runtimeOptions.failurePolicy, true)
})

test('a missing preview does not prevent deletion of the other preview', async () => {
  const f = fixture([['studies/own', { user: { id: 'alice' } }]], [imageNames('own')[1]])
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
  assert.equal(f.files.size, 0)
})

test('storage failure keeps the study discoverable and propagates for retry', async () => {
  const f = fixture([['users/alice', {}], ['studies/own', { user: { id: 'alice' } }]], imageNames('own'))
  f.fileFailures.add(imageNames('own')[1])
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), /storage unavailable/)
  assert.ok(f.documents.has('studies/own'))
  assert.ok(f.documents.has('users/alice'))
  f.fileFailures.clear()
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
  assert.equal(f.files.size, 0)
})

test('partial nested-data failure leaves the study root available to the next attempt', async () => {
  const f = fixture([
    ['users/alice', {}],
    ['studies/own', { user: { id: 'alice' } }],
    ['studies/own/children/first', {}],
    ['studies/own/children/second', {}],
  ])
  f.documentFailures.add('studies/own/children')
  await assert.rejects(f.users.deleteUser({ uid: 'alice' }), /firestore unavailable/)
  assert.ok(f.documents.has('studies/own'))
  f.documentFailures.clear()
  await f.users.deleteUser({ uid: 'alice' })
  assert.equal(f.documents.size, 0)
})

test('account deletion removes descendants even when the profile document is missing', async () => {
  const f = fixture([['users/alice/notes/missing/children/child', {}], ['users/bob/notes/keep', {}]])
  await f.users.deleteUser({ uid: 'alice' })
  assert.deepEqual([...f.documents.keys()], ['users/bob/notes/keep'])
})

test('standalone study deletion uses the document ID and tolerates duplicate events', async () => {
  const f = fixture([], [...imageNames('own'), ...imageNames('other')])
  const handler = f.studies().deleteStudy
  const snapshot = { id: 'own', data: () => ({ id: 'other' }) }
  await handler(snapshot, { params: { studyId: 'own' } })
  await handler(snapshot, { params: { studyId: 'own' } })
  assert.deepEqual([...f.files].sort(), imageNames('other').sort())
  assert.equal(handler.runtimeOptions.failurePolicy, true)
})

test('standalone study deletion reports storage failures instead of swallowing them', async () => {
  const f = fixture([], imageNames('own'))
  f.fileFailures.add(imageNames('own')[0])
  await assert.rejects(f.studies().deleteStudy({ id: 'own', data: () => ({ id: 'own' }) }, { params: { studyId: 'own' } }), /storage unavailable/)
})
