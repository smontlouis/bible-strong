import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import process from 'node:process'

const execFileAsync = promisify(execFile)
const apiBaseUrl = (process.env.RESOURCE_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(
  /\/$/u,
  ''
)
const artifactBaseUrl = (process.env.RESOURCE_ARTIFACT_BASE_URL ?? 'http://127.0.0.1:8788').replace(
  /\/$/u,
  ''
)

const smokeScripts = [
  'smokeBibleSearchResourceService.mjs',
  'smokeDictionaryResourceService.mjs',
  'smokeNaveResourceService.mjs',
  'smokeSupplementaryResourceService.mjs',
  'smokeTimelineResourceService.mjs',
  'smokeStrongLexiconResourceService.mjs',
]

const assertHealthy = async () => {
  const response = await fetch(`${apiBaseUrl}/health`)
  if (!response.ok) throw new Error(`RESOURCE_API_UNHEALTHY:${response.status}`)
}

await assertHealthy()

for (const script of smokeScripts) {
  const result = await execFileAsync(
    process.execPath,
    [path.join(process.cwd(), 'scripts', script)],
    {
      env: {
        ...process.env,
        RESOURCE_API_BASE_URL: apiBaseUrl,
        RESOURCE_ARTIFACT_BASE_URL: artifactBaseUrl,
      },
      maxBuffer: 4 * 1024 * 1024,
    }
  )
  process.stdout.write(`${script}:ok\n`)
  if (result.stderr) process.stderr.write(result.stderr)
}

console.log(
  JSON.stringify({
    ok: true,
    apiBaseUrl,
    artifactBaseUrl,
    smokeCount: smokeScripts.length,
  })
)
