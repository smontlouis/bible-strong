const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const appRoot = path.dirname(require.resolve('../../package.json'))
const updatesRoot = path.dirname(require.resolve('expo-updates/package.json'))
const { resolveRuntimeVersionAsync } = require(
  path.join(updatesRoot, 'utils/build/resolveRuntimeVersionAsync.js')
)
const legacyRuntime = 'a170e84b5290228c1fc1a7d1b850784dc093085c'
const betaRuntime = 'android-app-check-recaptcha-beta-v1'

// Exercise the resolver called by both EAS CLI and its build worker. A relocated
// fixture keeps machine paths and build-only environment variables in the test.
async function resolveInBuildDirectory(platform, overrides) {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'bible-strong-runtime-check-'))
  const env = {
    EXPO_NO_DOTENV: '1',
    ANDROID_APP_CHECK_BETA: undefined,
    ANDROID_APP_CHECK_BETA_VERSION_CODE: undefined,
    ANDROID_APP_CHECK_RECAPTCHA_SITE_KEY: 'validation_key_runtime_test_only',
    EAS_BUILD_PROFILE: undefined,
    EAS_BUILD_PLATFORM: undefined,
    EAS_BUILD: undefined,
    EAS_BUILD_WORKINGDIR: undefined,
    ...overrides,
  }
  const original = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  try {
    await fs.copyFile(path.join(appRoot, 'app.config.ts'), path.join(fixture, 'app.config.ts'))
    await fs.copyFile(path.join(appRoot, 'package.json'), path.join(fixture, 'package.json'))
    await fs.symlink(path.join(appRoot, 'node_modules'), path.join(fixture, 'node_modules'), 'dir')
    await fs.symlink(path.join(appRoot, 'plugins'), path.join(fixture, 'plugins'), 'dir')
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    return await resolveRuntimeVersionAsync(fixture, platform, {}, { workflowOverride: 'managed' })
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await fs.rm(fixture, { recursive: true, force: true })
  }
}

test('beta runtime agrees between CLI and EAS preparation in different directories', async () => {
  const local = await resolveInBuildDirectory('android', { ANDROID_APP_CHECK_BETA: 'true' })
  const builder = await resolveInBuildDirectory('android', {
    ANDROID_APP_CHECK_BETA: 'true',
    EAS_BUILD: '1',
    EAS_BUILD_PROFILE: 'app-check-beta',
    EAS_BUILD_PLATFORM: 'android',
    EAS_BUILD_WORKINGDIR: '/tmp/eas-build-working-directory',
  })
  assert.equal(local.runtimeVersion, betaRuntime)
  assert.equal(builder.runtimeVersion, local.runtimeVersion)
  assert.equal(builder.fingerprintSources, null)
})

test('standard Android keeps the published runtime, separate from the native beta', async () => {
  const standard = await resolveInBuildDirectory('android', { EAS_BUILD_PROFILE: 'production' })
  assert.equal(standard.runtimeVersion, legacyRuntime)
  assert.notEqual(standard.runtimeVersion, betaRuntime)
})

test('Apple retains its existing runtime', async () => {
  const apple = await resolveInBuildDirectory('ios', { EAS_BUILD_PROFILE: 'production' })
  assert.equal(apple.runtimeVersion, legacyRuntime)
})

test('beta cannot select its native runtime through the production build profile', async () => {
  await assert.rejects(
    resolveInBuildDirectory('android', {
      ANDROID_APP_CHECK_BETA: 'true',
      EAS_BUILD_PROFILE: 'production',
    }),
    /reserved for the app-check-beta build profile/
  )
})
