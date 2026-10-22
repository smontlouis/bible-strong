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

// Load one handler module with the Firebase and browser boundaries replaced. Node built-ins
// stay real, so the address checks of fetchOpenGraph run against the actual resolver.
function load(filename, mocks) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync(path.join(sourceRoot, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const moduleRequire = id => (id in mocks ? mocks[id] : require(id))
  vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})', { filename })(moduleRequire, module, module.exports)
  return module.exports
}

const response = () => {
  let finish
  const res = { statusCode: 200, headers: {}, events: [], done: new Promise(resolve => { finish = resolve }) }
  const respond = body => {
    res.body = body
    res.events.push('response')
    finish()
  }
  res.status = code => { res.statusCode = code; return res }
  res.send = respond
  res.json = respond
  res.end = respond
  res.setHeader = (name, value) => { res.headers[name] = value }
  return res
}

function studiesFixture(studies) {
  const launches = []
  const res = response()
  const browser = {
    newPage: async () => ({
      goto: async url => { launches.push(url); return { status: () => 200, ok: () => true } },
      pdf: async () => new Uint8Array([37, 80, 68, 70]),
    }),
    close: async () => { res.events.push('browser closed') },
  }
  const functions = options => ({
    runWith: next => functions(next),
    firestore: { document: () => ({ onDelete: handler => handler, onUpdate: handler => handler }) },
    https: { onRequest: handler => Object.assign(handler, { runtimeOptions: options }) },
  })
  const admin = {
    firestore: () => ({
      collection: name => ({
        doc: id => ({
          get: async () => {
            assert.equal(name, 'studies')
            return { exists: studies.has(id), data: () => studies.get(id) }
          },
        }),
      }),
    }),
    storage: () => ({ bucket: () => ({}) }),
  }
  const { exportStudyPDF } = load('studies.ts', {
    'firebase-functions/v1': functions({}),
    'firebase-admin': admin,
    'puppeteer-core': { launch: async () => browser },
    '@sparticuz/chromium-min': { args: [], executablePath: async () => '/chromium' },
    cors: () => (_req, _res, next) => next(),
    './studyFiles': { deleteStudyFiles: async () => {} },
  })
  const call = async req => {
    exportStudyPDF(req, res)
    await res.done
    return res
  }
  return { exportStudyPDF, launches, call }
}

test('exportStudyPDF refuses bad requests and unpublished studies before starting Chromium', async () => {
  const studies = new Map([
    ['private-study', { published: false }],
    ['study-1a2b', { published: true }],
  ])
  const cases = [
    [{ method: 'GET', body: { studyId: 'study-1a2b' } }, 405],
    [{ method: 'POST', body: {} }, 400],
    [{ method: 'POST', body: { studyId: '../../admin' } }, 400],
    [{ method: 'POST', body: { studyId: 'a/b' } }, 400],
    [{ method: 'POST', body: { studyId: ['study-1a2b'] } }, 400],
    [{ method: 'POST', body: { studyId: 'x'.repeat(129) } }, 400],
    [{ method: 'POST', body: { studyId: 'missing' } }, 404],
    [{ method: 'POST', body: { studyId: 'private-study' } }, 404],
  ]
  for (const [req, status] of cases) {
    const f = studiesFixture(studies)
    const res = await f.call(req)
    assert.equal(res.statusCode, status, JSON.stringify(req))
    assert.deepEqual(f.launches, [])
  }
})

test('exportStudyPDF prints a published study, closes Chromium first and caps instances', async () => {
  const f = studiesFixture(new Map([['study-1a2b', { published: true }]]))
  const res = await f.call({ method: 'POST', body: { studyId: 'study-1a2b' } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['Content-Type'], 'application/pdf')
  assert.deepEqual(f.launches, ['https://bible-strong.app/studies/study-1a2b'])
  assert.deepEqual(res.events, ['browser closed', 'response'])
  assert.equal(f.exportStudyPDF.runtimeOptions.maxInstances, 5)
  assert.equal(f.exportStudyPDF.runtimeOptions.timeoutSeconds, 60)
})

const scraperModule = () => () => ({})
const openGraph = () => load('open-graph.ts', {
  'firebase-functions/v2/https': { onRequest: (options, handler) => Object.assign(handler, { options }) },
  'firebase-admin': {
    auth: () => ({ verifyIdToken: async token => { if (token !== 'valid') throw new Error('invalid'); return { uid: 'u' } } }),
  },
  metascraper: () => async () => ({ title: 'Title' }),
  'metascraper-title': scraperModule,
  'metascraper-description': scraperModule,
  'metascraper-image': scraperModule,
  'metascraper-logo': scraperModule,
  'metascraper-author': scraperModule,
})

test('fetchOpenGraph only accepts public addresses', () => {
  const { isPublicAddress } = openGraph()
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPublicAddress(address), true, address)
  }
  for (const address of [
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.1', '192.168.1.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a9fe:a9fe', 'fc00::1', 'fd00:ec2::254',
    'fe80::1', 'ff02::1', '2001:db8::1', '2002:7f00:1::', '2001::1', 'not-an-ip',
  ]) {
    assert.equal(isPublicAddress(address), false, address)
  }
})

test('fetchOpenGraph refuses internal URLs, including names that resolve to them', async () => {
  const { fetchPublicHtml } = openGraph()
  const refused = [
    ['file:///etc/passwd', /unsupported_protocol/u],
    ['http://user:secret@example.com/', /credentials_in_url/u],
    ['http://example.com:8080/', /unsupported_port/u],
    ['http://127.0.0.1/', /blocked_address/u],
    ['http://2130706433/', /blocked_address/u],
    ['http://[::1]/', /blocked_address/u],
    ['http://[::ffff:169.254.169.254]/', /blocked_address/u],
    ['http://169.254.169.254/computeMetadata/v1/', /blocked_address/u],
    ['http://localhost/', /blocked_address localhost/u],
  ]
  for (const [url, error] of refused) {
    await assert.rejects(fetchPublicHtml(url), error, url)
  }
})

test('fetchOpenGraph answers invalid_url for internal targets before fetching', async () => {
  const { fetchOpenGraph } = openGraph()
  const res = response()
  await fetchOpenGraph({ headers: { authorization: 'Bearer valid' }, query: { url: 'http://169.254.169.254/' } }, res)
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'invalid_url' })
  assert.equal(fetchOpenGraph.options.maxInstances, 10)
})
