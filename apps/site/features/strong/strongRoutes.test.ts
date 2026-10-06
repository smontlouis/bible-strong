import { describe, expect, it } from 'vitest'
import { renderStrongDefinitionHtml } from './strongHtml'
import {
  buildStrongPath,
  buildWebAppStrongUrl,
  displayStrongCode,
  parseStrongCode,
  strongCodeSlug,
} from './strongRoutes'

describe('Strong public routes', () => {
  it('normalizes a classical code to its padded identity', () => {
    expect(parseStrongCode('h430')?.code).toBe('H0430')
    expect(parseStrongCode('G26')?.code).toBe('G0026')
  })

  it('keeps the suffix case, which distinguishes two entries', () => {
    expect(parseStrongCode('h1254a')).toEqual({ kind: 'dstrong', code: 'H1254a' })
    expect(parseStrongCode('h1254A')).toEqual({ kind: 'dstrong', code: 'H1254A' })
    expect(strongCodeSlug('H1254A')).toBe('h1254A')
  })

  it('rejects anything that is not a Strong code', () => {
    for (const value of ['', 'fr', 'entity', 'x12', 'h', '430', 'h43-0']) {
      expect(parseStrongCode(value)).toBeUndefined()
    }
  })

  it('builds the language-scoped site path and the language-less workspace URL', () => {
    expect(buildStrongPath('fr', 'H430')).toBe('/strong/fr/h0430')
    expect(buildStrongPath('en', 'g0026')).toBe('/strong/en/g0026')
    expect(buildWebAppStrongUrl('H0430G')).toBe('https://web.bible-strong.app/strong/h0430G')
    expect(() => buildStrongPath('fr', 'nope')).toThrow('STRONG_ROUTE_INVALID')
  })

  it('displays codes without padding', () => {
    expect(displayStrongCode('H0430')).toBe('H430')
    expect(displayStrongCode('H0430G')).toBe('H430G')
    expect(displayStrongCode('G0026')).toBe('G26')
  })
})

describe('Strong definition HTML', () => {
  const render = (html: string) =>
    renderStrongDefinitionHtml(html, { language: 'fr', currentCode: 'H0085' })

  it('links the Strong codes cited in a definition', () => {
    expect(render('fils de : Térach (H8646) ; frère de Nachor (H5152H)')).toBe(
      'fils de : Térach (<a href="/strong/fr/h8646">H8646</a>) ; frère de Nachor (<a href="/strong/fr/h5152H">H5152H</a>)'
    )
    expect(render('From <strong>G25</strong>; love')).toBe(
      'From <strong><a href="/strong/fr/g0025">G25</a></strong>; love'
    )
  })

  it('does not link the entry to itself nor codes embedded in other words', () => {
    expect(render('Abraham (H0085), voir IG12 et PH430x')).toBe(
      'Abraham (H0085), voir IG12 et PH430x'
    )
  })
})
