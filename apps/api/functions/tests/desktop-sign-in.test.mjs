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

function load(admin) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path.join(sourceRoot, 'desktop-sign-in.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const mocks = {
    'firebase-admin': admin,
    'firebase-functions/v2/https': {
      onRequest: (options, handler) => Object.assign(handler, { options }),
    },
  }
  const moduleRequire = id => (id in mocks ? mocks[id] : require(id))
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})', {
    filename: 'desktop-sign-in.ts',
  })(moduleRequire, module, module.exports)
  return module.exports
}

const response = () => {
  const res = { statusCode: 200, headers: {} }
  res.status = code => {
    res.statusCode = code
    return res
  }
  res.set = (name, value) => {
    res.headers[name] = value
    return res
  }
  res.json = body => {
    res.body = body
  }
  return res
}

const adminFor = ({ authTime = Date.now() / 1000, fail = false } = {}) => {
  const calls = []
  return {
    calls,
    auth: () => ({
      verifyIdToken: async (token, checkRevoked) => {
        calls.push(['verify', token, checkRevoked])
        if (fail) throw new Error('invalid')
        return { uid: 'reader-1', auth_time: authTime }
      },
      createCustomToken: async uid => {
        calls.push(['custom', uid])
        return `custom-for-${uid}`
      },
    }),
  }
}

const post = authorization => ({ method: 'POST', headers: authorization ? { authorization } : {} })

test('mints a custom token for a fresh sign-in, checking revocation', async () => {
  const admin = adminFor()
  const { createDesktopSignInToken } = load(admin)
  const res = response()
  await createDesktopSignInToken(post('Bearer id-token'), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { token: 'custom-for-reader-1' })
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.deepEqual(admin.calls[0], ['verify', 'id-token', true])
})

test('refuses a sign-in older than a few minutes', async () => {
  const admin = adminFor({ authTime: Date.now() / 1000 - 60 * 60 })
  const { createDesktopSignInToken } = load(admin)
  const res = response()
  await createDesktopSignInToken(post('Bearer id-token'), res)
  assert.equal(res.statusCode, 401)
  assert.deepEqual(res.body, { error: 'stale_sign_in' })
  assert.equal(admin.calls.some(([name]) => name === 'custom'), false)
})

test('refuses missing or invalid ID tokens and other methods', async () => {
  const { createDesktopSignInToken } = load(adminFor({ fail: true }))
  const missing = response()
  await createDesktopSignInToken(post(), missing)
  assert.equal(missing.statusCode, 401)
  const invalid = response()
  await createDesktopSignInToken(post('Bearer forged'), invalid)
  assert.deepEqual(invalid.body, { error: 'invalid_token' })
  const get = response()
  await createDesktopSignInToken({ method: 'GET', headers: {} }, get)
  assert.equal(get.statusCode, 405)
})

test('only answers the sign-in page origins', () => {
  const { createDesktopSignInToken } = load(adminFor())
  assert.deepEqual(createDesktopSignInToken.options.cors, [
    'https://web.bible-strong.app',
    'http://localhost:9090',
  ])
})
