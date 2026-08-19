import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { R2ArtifactStore } from './r2ArtifactPublisher'

type RunWrangler = (args: string[]) => Promise<void>

const defaultRunWrangler =
  (env: NodeJS.ProcessEnv): RunWrangler =>
  args =>
    new Promise((resolve, reject) => {
      execFile(
        path.resolve(process.cwd(), 'node_modules/.bin/wrangler'),
        args,
        { env, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (!error) {
            resolve()
            return
          }
          reject(
            new Error([error.message, stdout, stderr].filter(Boolean).join('\n'), { cause: error })
          )
        }
      )
    })

const isMissingObjectFailure = (cause: unknown) =>
  cause instanceof Error &&
  /specified key does not exist|NoSuchKey|object not found/i.test(cause.message)

const isTransientWranglerFailure = (cause: unknown) =>
  cause instanceof Error &&
  /\b401\b.*Unauthorized|\b429\b|\b5\d{2}\b|Gateway Timeout|Upstream service unavailable/i.test(
    cause.message
  )

const wait = (milliseconds: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds)
  })

export class WranglerR2ArtifactStore implements R2ArtifactStore {
  private readonly bucket: string
  private readonly runWrangler: RunWrangler
  private readonly retryDelaysMs: readonly number[]

  constructor(options: {
    bucket: string
    runWrangler?: RunWrangler
    env?: NodeJS.ProcessEnv
    retryDelaysMs?: readonly number[]
  }) {
    if (!options.bucket.trim()) throw new Error('RESOURCE_R2_BUCKET_REQUIRED')
    this.bucket = options.bucket
    this.runWrangler = options.runWrangler ?? defaultRunWrangler(options.env ?? process.env)
    this.retryDelaysMs = options.retryDelaysMs ?? [500, 1_000, 2_000]
  }

  private async runWranglerWithRetry(args: string[]) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.runWrangler(args)
        return
      } catch (cause) {
        const retryDelay = this.retryDelaysMs[attempt]
        if (retryDelay === undefined || !isTransientWranglerFailure(cause)) throw cause
        await wait(retryDelay)
      }
    }
  }

  async get(key: string) {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'bible-strong-r2-get-'))
    const destination = path.join(temporaryDirectory, 'object')
    try {
      await this.runWranglerWithRetry([
        'r2',
        'object',
        'get',
        `${this.bucket}/${key}`,
        '--file',
        destination,
        '--remote',
      ])
      return await readFile(destination)
    } catch (cause) {
      if (isMissingObjectFailure(cause)) return undefined
      throw new Error(`R2_OBJECT_READ_FAILED:${key}`, { cause })
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }

  async putFile(key: string, filePath: string, mediaType: string) {
    try {
      await this.runWranglerWithRetry([
        'r2',
        'object',
        'put',
        `${this.bucket}/${key}`,
        '--file',
        filePath,
        '--content-type',
        mediaType,
        '--cache-control',
        'private, no-store',
        '--remote',
      ])
    } catch (cause) {
      throw new Error(`R2_OBJECT_WRITE_FAILED:${key}`, { cause })
    }
  }

  async putBytes(key: string, bytes: Buffer, mediaType: string) {
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'bible-strong-r2-put-'))
    const source = path.join(temporaryDirectory, 'object')
    try {
      await writeFile(source, bytes)
      await this.putFile(key, source, mediaType)
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
}
