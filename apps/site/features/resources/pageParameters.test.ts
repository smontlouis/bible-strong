import { describe, expect, it } from 'vitest'
import { addressWithReadParameters, knownInlineCommentaries } from './pageParameters'

const moved = (address: string) =>
  addressWithReadParameters(new URL(address, 'https://bible-strong.app'))

describe('Parameters a page reads', () => {
  it.each([
    '/bible/lsg/gen/1',
    '/bible/lsg/gen/1?commentary=barnes',
    '/bible/lsg/gen/1?commentary=barnes.mhy-fr',
    '/bible/kjv/strong/jhn/3/16?commentary=mhcc',
    '/strong/fr/g26/concordance?book=jhn',
    '/strong/fr/g26/concordance/2?book=jhn',
    '/commentary/fr/mhy-fr/gen/1?page=2',
    '/dictionary/fr/westphal/a?page=3',
    '/give?p=audibible',
    '/fr/give?p=audibible',
  ])('leaves %s where it is', address => {
    expect(moved(address)).toBeUndefined()
  })

  it('sends a page to its address without a parameter it does not read', () => {
    expect(moved('/bible/lsg/gen/1?auditjunk=1')).toBe('https://bible-strong.app/bible/lsg/gen/1')
    expect(moved('/strong/fr/g26?book=jhn')).toBe('https://bible-strong.app/strong/fr/g26')
    expect(moved('/dictionary/fr/term/grace?page=2')).toBe(
      'https://bible-strong.app/dictionary/fr/term/grace'
    )
    expect(moved('/commentary/fr/mhy-fr/gen/1/1-3?page=2')).toBe(
      'https://bible-strong.app/commentary/fr/mhy-fr/gen/1/1-3'
    )
    expect(moved('/?ref=x')).toBe('https://bible-strong.app/')
    expect(moved('/sitemaps/pages.xml?x=1')).toBe('https://bible-strong.app/sitemaps/pages.xml')
  })

  it('keeps the parameters the page reads, in their order and as written', () => {
    expect(moved('/strong/fr/g26/concordance?x=1&book=1%20jn&y=2')).toBe(
      'https://bible-strong.app/strong/fr/g26/concordance?book=1%20jn'
    )
    expect(moved('/dictionary/fr/westphal/a?page=2&page=3&junk')).toBe(
      'https://bible-strong.app/dictionary/fr/westphal/a?page=2&page=3'
    )
  })

  it('keeps what a sharer adds to a link, without sending anyone away for it', () => {
    expect(moved('/bible/lsg/gen/1?utm_source=newsletter&fbclid=abc&gclid=1')).toBeUndefined()
    expect(moved('/bible/lsg/gen/1?utm_source=newsletter&junk=1&commentary=barnes')).toBe(
      'https://bible-strong.app/bible/lsg/gen/1?utm_source=newsletter&commentary=barnes'
    )
  })

  it('leaves alone the answers that are not pages', () => {
    expect(moved('/_serverFn/abc?payload=%7B%7D&createServerFn')).toBeUndefined()
    expect(moved('/share-card/abc.def?v=2')).toBeUndefined()
  })

  it('ignores empty pairs and names it cannot read', () => {
    expect(moved('/bible/lsg/gen/1?&commentary=barnes&')).toBeUndefined()
    expect(moved('/bible/lsg/gen/1?%E0%A4%A=1')).toBe('https://bible-strong.app/bible/lsg/gen/1')
  })
})

describe('Commentaries named in the address of a Bible page', () => {
  it('drops the names the catalog does not know', () => {
    expect(moved('/bible/lsg/gen/1?commentary=auditjunk')).toBe(
      'https://bible-strong.app/bible/lsg/gen/1'
    )
    expect(moved('/bible/lsg/gen/1?commentary=barnes.auditjunk')).toBe(
      'https://bible-strong.app/bible/lsg/gen/1?commentary=barnes'
    )
    expect(moved('/bible/lsg/gen/1?commentary=')).toBe('https://bible-strong.app/bible/lsg/gen/1')
  })

  it('writes the choice in its one spelling', () => {
    expect(moved('/bible/lsg/gen/1?commentary=mhy-fr.barnes')).toBe(
      'https://bible-strong.app/bible/lsg/gen/1?commentary=barnes.mhy-fr'
    )
    // A form without scripting sends one value per checked box.
    expect(moved('/bible/lsg/gen/1?commentary=mhy-fr&commentary=barnes')).toBe(
      'https://bible-strong.app/bible/lsg/gen/1?commentary=barnes.mhy-fr'
    )
  })

  it('keeps the choice made in the other language', () => {
    expect(knownInlineCommentaries(['mhcc.mhy-fr'])).toBe('mhcc.mhy-fr')
    expect(knownInlineCommentaries(['unknown', ''])).toBeUndefined()
  })
})
