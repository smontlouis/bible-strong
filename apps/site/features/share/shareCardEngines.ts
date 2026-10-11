import { env } from 'cloudflare:workers'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm'
import layoutWasm from 'satori/layout.wasm'
import satori, { init } from 'satori/standalone'
import { SHARE_CARD_FONT_FILES, type ShareCardFont } from './shareCardFonts'

// The layout engine and the rasteriser are WebAssembly. A Worker may not compile
// WebAssembly while it runs, so both are imported as compiled modules and started once per
// instance; the standalone build of the layout engine is the one that accepts its module.
let started: Promise<void> | undefined

export const startShareCardEngines = (): Promise<void> => {
  started ??= Promise.all([init(layoutWasm), initWasm(resvgWasm)]).then(
    () => undefined,
    cause => {
      started = undefined
      throw cause
    }
  )
  return started
}

let loaded: Promise<ShareCardFont[]> | undefined

/**
 * The fonts of the cards, read once per instance from the public files of the site, which
 * the Worker reaches through its own binding rather than over the network. The binding
 * ignores the host of the address; the development server does not, and only answers its own.
 */
export const loadShareCardFonts = (origin: string): Promise<ShareCardFont[]> => {
  loaded ??= Promise.all(
    SHARE_CARD_FONT_FILES.map(async ({ file, ...font }) => {
      const response = await env.ASSETS.fetch(
        new URL(`/fonts/${encodeURIComponent(file)}`, origin)
      )
      if (!response.ok) throw new Error(`SHARE_CARD_FONT_UNAVAILABLE: ${response.status} ${file}`)
      return { ...font, data: await response.arrayBuffer() }
    })
  ).catch(cause => {
    // A failed read is not kept: the next image asks again.
    loaded = undefined
    throw cause
  })
  return loaded
}

export { Resvg, satori }
