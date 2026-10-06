import { sanitizeEditorialHtml } from '../resources/editorialHtml'
import type { ResourceLanguage } from '../resources/publicSite'
import { buildStrongPath, displayStrongCode, parseStrongCode } from './strongRoutes'

// A Strong code standing on its own: `H8646`, `G25`, or a sense such as `H5152H`.
const STRONG_CODE_PATTERN = /(?<![\p{L}\p{N}])[HG]\d{1,5}[A-Za-z]?(?![\p{L}\p{N}])/gu

/** Sanitizes a lexicon definition and turns the Strong codes it cites into page links. */
export const renderStrongDefinitionHtml = (
  html: string,
  { language, currentCode }: { language: ResourceLanguage; currentCode: string }
): string =>
  sanitizeEditorialHtml(html, text =>
    text.replace(STRONG_CODE_PATTERN, raw => {
      const identity = parseStrongCode(raw)
      if (!identity || identity.code === currentCode) return raw
      return `<a href="${buildStrongPath(language, identity.code)}">${displayStrongCode(identity.code)}</a>`
    })
  )
