import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  HARFBUZZ_CALLBACK_SIGNATURES,
  harfBuzzCallbackModule,
  rewriteSatoriForWorkers,
} from './satoriForWorkers'

const require = createRequire(import.meta.url)
const standalone = readFileSync(
  require.resolve('satori/standalone').replace(/standalone\.cjs$/u, 'standalone.js'),
  'utf8'
)

describe('Layout library of the share images, rewritten for Workers', () => {
  it('finds each place to rewrite in the installed release', () => {
    const rewritten = rewriteSatoriForWorkers(standalone)

    expect(rewritten).not.toContain('self.location.href')
    expect(rewritten).not.toContain('new WebAssembly.Module(uA)')
    expect(rewritten).toContain("import __harfBuzzModule from 'harfbuzzjs/hb.wasm';")
  })

  it('refuses a release in which a place moved, rather than leave it as it is', () => {
    expect(() => rewriteSatoriForWorkers('no such code')).toThrow(/SATORI_FOR_WORKERS/u)
    expect(() => rewriteSatoriForWorkers(`${standalone}self.location.href`)).toThrow(
      /expected one "self\.location\.href", found 2/u
    )
  })

  it('gives the library the very module it carries', () => {
    const carried = /"(AGFzbQ[A-Za-z0-9+/=]+)"/u.exec(standalone)?.[1]
    expect(carried).toBeDefined()

    const packaged = readFileSync(require.resolve('harfbuzzjs/hb.wasm'))
    expect(Buffer.from(carried!, 'base64').equals(packaged)).toBe(true)
  })

  it('has a callback module for every signature the shaping library registers', () => {
    const shaping = readFileSync(require.resolve('harfbuzzjs/hbjs.js'), 'utf8')
    const registered = new Set(
      [...shaping.matchAll(/addFunction\([\s\S]*?,\s*'([a-z]+)'\s*\)/gu)].map(match => match[1])
    )

    expect(registered.size).toBeGreaterThan(0)
    expect([...registered].sort()).toEqual([...HARFBUZZ_CALLBACK_SIGNATURES].sort())
  })

  it.each(HARFBUZZ_CALLBACK_SIGNATURES)('writes a module that calls a %s function back', sig => {
    const bytes = harfBuzzCallbackModule(sig)
    expect(WebAssembly.validate(bytes)).toBe(true)

    const received: unknown[][] = []
    const callback = (...values: unknown[]) => {
      received.push(values)
      return 7
    }
    const { f } = new WebAssembly.Instance(new WebAssembly.Module(bytes), { e: { f: callback } })
      .exports as { f: (...values: number[]) => number | undefined }
    const result = f(...Array.from({ length: sig.length - 1 }, (_, index) => index + 1))

    expect(received).toHaveLength(1)
    expect(received[0]).toHaveLength(sig.length - 1)
    expect(result).toBe(sig[0] === 'v' ? undefined : 7)
  })
})
