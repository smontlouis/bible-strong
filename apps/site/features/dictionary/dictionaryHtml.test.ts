import { describe, expect, it } from 'vitest'
import { dictionaryArticleExcerpt, renderDictionaryArticleHtml } from './dictionaryHtml'

const render = (html: string, language: 'fr' | 'en' = 'fr') =>
  renderDictionaryArticleHtml(html, { language, work: 'bost', entryId: 2 })

describe('Dictionary article links', () => {
  it('opens another article of the work by its identity and heading', () => {
    expect(
      render(
        'fils de <a class="word" href="Jokébed" data-entry-id="1199" data-link-origin="generated">Jokébed</a>'
      )
    ).toBe('fils de <a href="/dictionary/fr/bost/1199/jokebed">Jokébed</a>')
  })

  it('reads a heading written with entities or single quotes', () => {
    expect(render('<a class="word" href="Aaron&#39;s Rod" data-entry-id="4">ROD</a>', 'en')).toBe(
      '<a href="/dictionary/en/bost/4/aaron-s-rod">ROD</a>'
    )
    expect(render("<a data-entry-id='7' href='Ab (2)' class='word'>Ab</a>")).toBe(
      '<a href="/dictionary/fr/bost/7/ab-2">Ab</a>'
    )
  })

  it('does not link an article to itself', () => {
    expect(render('<a class="word" href="Aaron" data-entry-id="2">Aaron</a> parle')).toBe(
      'Aaron parle'
    )
  })

  it('opens a Bible passage in the reference Bible of the language', () => {
    expect(render('<a class="verse bible-ref" href="bible://Exod.6.20">Exode 6.20</a>')).toBe(
      '<a href="/bible/lsg/exod/6/20">Exode 6.20</a>'
    )
    expect(render('<a href="bible://Exod.4.14-Exod.4.16">Ex 4</a>', 'en')).toBe(
      '<a href="/bible/kjv/exod/4/14-16">Ex 4</a>'
    )
    expect(render('<a href="bible://Lev.8">Lévitique 8</a>')).toBe(
      '<a href="/bible/lsg/lev/8">Lévitique 8</a>'
    )
  })

  it('opens a list of passages or a range of chapters at its first passage', () => {
    expect(render('<a href="bible://Rev.1.8,Rev.1.11">Ap 1.8, 11</a>')).toBe(
      '<a href="/bible/lsg/rev/1/8">Ap 1.8, 11</a>'
    )
    expect(render('<a href="bible://Isa.36-Isa.39">Ésaïe 36–39</a>')).toBe(
      '<a href="/bible/lsg/isa/36">Ésaïe 36–39</a>'
    )
    expect(render('<a href="bible://Lev.25.39-Lev.25.42,Lev.25.47-Lev.25.54">Lv 25</a>')).toBe(
      '<a href="/bible/lsg/lev/25/39-42">Lv 25</a>'
    )
  })

  it('keeps the text of a passage the reference Bible does not hold', () => {
    expect(render('<a href="bible://Sir.24.1">Siracide 24.1</a>')).toBe('Siracide 24.1')
    expect(render('<a href="bible://Nope.1.1">?</a>')).toBe('?')
  })

  it('opens a Strong entry', () => {
    expect(render('<a class="strong-ref" href="strong://H0175">H0175</a>', 'en')).toBe(
      '<a href="/strong/en/h0175">H0175</a>'
    )
  })

  it('drops every other link and never emits a source target', () => {
    expect(
      render(
        '<a href="https://web.bible-strong.app/x">app</a> <a href="/dictionary/fr/bost/1/a">a</a> <a href="Amram">b</a>'
      )
    ).toBe('app a b')
  })
})

describe('Dictionary article markup', () => {
  it('moves the headings of an article right under the page title', () => {
    expect(render('<h2>A (1)</h2><p>un</p><h3>Suite</h3><h4>Détail</h4>')).toBe(
      '<h2>A (1)</h2><p>un</p><h2>Suite</h2><h3>Détail</h3>'
    )
  })

  it('drops the wrappers of a source and keeps its text', () => {
    expect(
      render(
        '<p>(<span class="quick_pick"><a href="bible://Num.26.59">Nombres&nbsp;26.59</a></span>)</p>'
      )
    ).toBe('<p>(<a href="/bible/lsg/num/26/59">Nombres&nbsp;26.59</a>)</p>')
    expect(
      render('<p class="text-center"><img src="Calmet/Nazareth.jpg" alt="Nazareth"></p>')
    ).toBe('')
  })

  it('ends a paragraph where a block starts inside it', () => {
    expect(
      render(
        "<p>un</p></div></p><p>\n<div class='sserif' style='margin-top:15px'><p><strong>Deux</strong></p><p>trois</p></div>"
      )
    ).toBe('<p>un</p><p><strong>Deux</strong></p><p>trois</p>')
    expect(render('<p>liste<ul><li>a</li></ul>suite</p>')).toBe(
      '<p>liste</p><ul><li>a</li></ul>suite'
    )
    expect(render('<p>un <i>deux <p>trois</p> quatre</i></p>')).toBe(
      '<p>un <i>deux </i></p><p>trois</p> quatre'
    )
  })

  it('leaves the paragraphs of a list item or a quotation in place', () => {
    const html = '<ul><li><p>a</p><p>b</p></li></ul><blockquote><p>c</p></blockquote>'
    expect(render(html)).toBe(html)
  })
})

describe('dictionaryArticleExcerpt', () => {
  it('reads the first words across blocks as plain text', () => {
    expect(
      dictionaryArticleExcerpt(
        '<h2>Definition</h2><p>Aaron was Moses&#x2019; older brother.</p><ul><li>He helped Moses.</li></ul>',
        155
      )
    ).toBe('Definition Aaron was Moses’ older brother. He helped Moses.')
  })

  it('stays within the length of a description', () => {
    const excerpt = dictionaryArticleExcerpt(`<p>${'mot '.repeat(100)}</p>`, 155)
    expect(excerpt.length).toBeLessThanOrEqual(155)
    expect(excerpt.endsWith('…')).toBe(true)
  })
})
