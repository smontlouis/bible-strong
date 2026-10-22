import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/iaphub.ts')

// The webhook with Firebase replaced: users are a map, updates are recorded.
function webhook(users) {
  const updates = []
  const functions = {
    runWith: options => ({
      https: { onRequest: handler => Object.assign(handler, { runtimeOptions: options }) },
    }),
  }
  const admin = {
    firestore: () => ({
      collection: () => ({
        doc: id => ({
          get: async () => ({ exists: id in users }),
          update: async value => {
            updates.push([id, value])
          },
        }),
      }),
    }),
  }
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const mocks = { 'firebase-functions/v1': functions, 'firebase-admin': admin }
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})', { filename: 'iaphub.ts' })(
    id => (id in mocks ? mocks[id] : require(id)),
    module,
    module.exports
  )
  return { handler: module.exports.iaphub, updates }
}

const call = async (handler, { token, body }) => {
  const res = { statusCode: 200 }
  await new Promise(resolve => {
    res.status = code => {
      res.statusCode = code
      return res
    }
    res.send = body => {
      res.body = body
      resolve()
    }
    res.json = res.send
    handler(
      { method: 'POST', body, get: name => (name.toLowerCase() === 'x-auth-token' ? token : undefined) },
      res
    )
  })
  return res
}

const renewal = userId => ({
  type: 'subscription_renewal',
  data: { userId, productSku: 'com.smontlouis.biblestrong.onemonth.min' },
})

test('the IAPHUB webhook needs its token, and keeps the subscription of known accounts', async () => {
  process.env.IAPHUB_WEBHOOK_TOKEN = 'secret-token'
  const { handler, updates } = webhook({ alice: {} })

  assert.deepEqual(handler.runtimeOptions, { secrets: ['IAPHUB_WEBHOOK_TOKEN'] })
  assert.equal((await call(handler, { body: renewal('alice') })).statusCode, 401)
  assert.equal((await call(handler, { token: 'wrong', body: renewal('alice') })).statusCode, 401)
  assert.deepEqual(updates, [])

  const renewed = await call(handler, { token: 'secret-token', body: renewal('alice') })
  assert.equal(renewed.statusCode, 200)
  assert.deepEqual(updates, [['alice', { subscription: 'basic' }]])

  const expired = await call(handler, {
    token: 'secret-token',
    body: { type: 'subscription_expire', data: { userId: 'alice' } },
  })
  assert.equal(expired.statusCode, 200)
  assert.deepEqual(updates.at(-1), ['alice', { subscription: null }])

  // An account deleted since, or a purchase without one, is acknowledged and left alone.
  const unknown = await call(handler, { token: 'secret-token', body: renewal('bob') })
  assert.equal(unknown.statusCode, 200)
  const anonymous = await call(handler, { token: 'secret-token', body: renewal(undefined) })
  assert.equal(anonymous.statusCode, 200)
  assert.equal(updates.length, 2)
})

test('the IAPHUB webhook refuses everything while its secret is not set', async () => {
  delete process.env.IAPHUB_WEBHOOK_TOKEN
  const { handler, updates } = webhook({ alice: {} })
  assert.equal((await call(handler, { token: '', body: renewal('alice') })).statusCode, 401)
  assert.equal((await call(handler, { token: 'anything', body: renewal('alice') })).statusCode, 401)
  assert.deepEqual(updates, [])
})
