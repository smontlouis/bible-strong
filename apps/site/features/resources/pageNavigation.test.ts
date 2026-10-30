import { describe, expect, it } from 'vitest'
import { fadesToNextPage, siteAddress } from './pageNavigation'

describe('A link of the site', () => {
  it('leads inside the site with its path, its parameters and its anchor', () => {
    expect(siteAddress('/bible/lsg/gen/1')).toEqual({ to: '/bible/lsg/gen/1', search: {} })
    expect(siteAddress('/strong/fr/H1732/concordance?book=gen#verses')).toEqual({
      to: '/strong/fr/H1732/concordance',
      search: { book: 'gen' },
      hash: 'verses',
    })
    expect(siteAddress('/atlas/fr/cards/Israel@Gen.25.26-Rev~vieux')?.to).toBe(
      '/atlas/fr/cards/Israel@Gen.25.26-Rev~vieux'
    )
  })

  it('is left to the browser when it leaves the site or stays on the page', () => {
    expect(siteAddress('https://web.bible-strong.app')).toBeUndefined()
    expect(siteAddress('//example.org/page')).toBeUndefined()
    expect(siteAddress('#passages')).toBeUndefined()
    expect(siteAddress('mailto:contact@example.org')).toBeUndefined()
  })
})

describe('A move between pages', () => {
  it('fades when the page changes', () => {
    expect(fadesToNextPage('/', '/bible')).toBe(true)
    expect(fadesToNextPage('/atlas/fr/cards', '/atlas/fr/David@Rut.4.17-Rev')).toBe(true)
  })

  it('does not when the page stays, nor when a card opens over the gallery', () => {
    expect(fadesToNextPage('/bible', '/bible')).toBe(false)
    expect(fadesToNextPage(undefined, '/bible')).toBe(false)
    expect(fadesToNextPage('/atlas/fr/cards', '/atlas/fr/cards/David@Rut.4.17-Rev')).toBe(false)
    expect(fadesToNextPage('/atlas/fr/cards/A@Gen.1', '/atlas/fr/cards/B@Gen.2')).toBe(false)
  })
})
