import { describe, expect, it } from 'vitest'
import { commentaryExcerpt, renderCommentaryHtml } from './commentaryHtml'

const render = (html: string) => renderCommentaryHtml(html, { language: 'fr' })

describe('Commentary links', () => {
  it('resolves Bible references to pages of the site', () => {
    expect(
      render('Voir <a class="bible-ref" href="bible://John.1.13" data-osis="John.1.13">Jean 1.13</a>.')
    ).toBe('Voir <a href="/bible/lsg/john/1/13">Jean 1.13</a>.')
    expect(
      renderCommentaryHtml('<a href="bible://Num.21.6-Num.21.9">Num 21:6-9</a>', { language: 'en' })
    ).toBe('<a href="/bible/kjv/num/21/6-9">Num 21:6-9</a>')
  })

  it('links a word tagged with its Strong number to that entry', () => {
    expect(render('(Greek - <w lemma="strong:G622">ἀπόλλυμι</w>)')).toBe(
      '(Greek - <a href="/strong/fr/g0622">ἀπόλλυμι</a>)'
    )
  })

  it('drops a link it cannot resolve and keeps its text', () => {
    expect(render('<a href="bible://Matt.5-Matt.7">Matt 5-7</a>')).toBe('Matt 5-7')
    expect(render('<a href="https://example.org/x">ailleurs</a>')).toBe('ailleurs')
    expect(render('<a href="/commentary-entry?id=1">app</a>')).toBe('app')
  })

  it('leaves out a link to the publisher of the source, label included', () => {
    expect(
      render(
        '<p>Texte.</p><p><a class="external-source" href="https://text.egwwritings.org/read/9.2255">View “Chapter” in context ↗</a></p>'
      )
    ).toBe('<p>Texte.</p>')
    expect(
      render('Texte <a href="https://text.egwwritings.org/read/9" class="external-source">↗</a>.')
    ).toBe('Texte .')
  })
})

describe('Commentary markup dialects', () => {
  it('rewrites GBF formatting and reference marks', () => {
    expect(
      render(
        '<FU>#<a class="bible-ref" href="bible://John.3.1">Joh 3:1</a>|<Fu> <FB>Now there was<Fb> a <FI>second<Fi> birth'
      )
    ).toBe('<a href="/bible/lsg/john/3/1">Joh 3:1</a> <b>Now there was</b> a <i>second</i> birth')
  })

  it('rewrites OSIS catch words, notes, outlines, line breaks and note marks', () => {
    expect(render('<catchWord>Now</catchWord> (<foreign xml:lang="grc">δε</foreign>).')).toBe(
      '<b>Now</b> (δε).'
    )
    expect(render('aucun mal<note type="crossReference"> Luc 4, 29-30 </note> ».')).toBe(
      'aucun mal<small> (Luc 4, 29-30)</small> ».'
    )
    expect(
      render('Analyse <list> <item type="x-indent-1">1. Premier</item> <item>2. Second</item> </list>')
    ).toBe('Analyse  <p>1. Premier</p> <p>2. Second</p> ')
    expect(render('<h4>Titre</h4> <lb/>Texte <mn>[1]</mn>')).toBe('<h3>Titre</h3> <br>Texte <sup>[1]</sup>')
  })

  it('raises verse and paragraph numbers running in the text', () => {
    expect(render('<span>1</span> There was a man <span class="ref">Mal. ii. 7</span>')).toBe(
      '<sup>1</sup> There was a man Mal. ii. 7'
    )
  })

  it('restores character references escaped twice', () => {
    expect(render('la vie&amp;nbsp;; d&amp;#233;j&amp;#xE0; &amp;c.')).toBe(
      'la vie&nbsp;; d&#233;j&#xE0; &amp;c.'
    )
  })

  it('keeps headings right under the section title', () => {
    expect(render('<h4>Born Again</h4>Texte')).toBe('<h3>Born Again</h3>Texte')
    expect(render('<h3>Livre</h3><h4>Chapitre</h4>')).toBe('<h3>Livre</h3><h4>Chapitre</h4>')
  })

  it('never lets source markup through', () => {
    expect(render('<p onclick="x()" style="color:red">a</p><script>alert(1)</script>')).toBe(
      '<p>a</p>alert(1)'
    )
    expect(render('<span data-content=\'&lt;div class="x"&gt;NT&lt;/div&gt;\' class="help-popup">du NT</span>')).toBe(
      'du NT'
    )
  })
})

describe('Commentary paragraphs', () => {
  it('closes a paragraph where a block starts inside it', () => {
    expect(render('<p>Avant<ol><li>un</li></ol>après</p>')).toBe(
      '<p>Avant</p><ol><li>un</li></ol>après'
    )
    expect(render('<p>un<p>deux</p></p>')).toBe('<p>un</p><p>deux</p>')
  })

  it('leaves well-formed paragraphs alone', () => {
    const html = '<p>un <b>deux</b></p><ul><li><p>trois</p></li></ul><blockquote><p>quatre</p></blockquote>'
    expect(render(html)).toBe(html)
  })

  it('drops paragraphs left empty', () => {
    expect(render('<p>Texte.</p>\n\n<p></p>')).toBe('<p>Texte.</p>\n\n')
    expect(render('<p> <br /> </p><p>Suite</p>')).toBe('<p>Suite</p>')
  })
})

describe('Commentary excerpt', () => {
  it('opens on the text under the headings, as plain text', () => {
    expect(
      commentaryExcerpt(
        '<h3>L&#x2019;entretien (1-21)</h3><p>Nicod&#xE8;me vint &ldquo;de nuit&rdquo;.</p><p>Il fut accueilli.</p>',
        155
      )
    ).toBe('Nicodème vint “de nuit”. Il fut accueilli.')
  })

  it('falls back on the headings of a section that has nothing else', () => {
    expect(commentaryExcerpt('<h3>Psaume 23</h3>', 155)).toBe('Psaume 23')
  })

  it('leaves out character references metadata cannot carry and cuts on a word', () => {
    expect(commentaryExcerpt('le mot &delta;&iota; didaskalos', 155)).toBe('le mot didaskalos')
    expect(commentaryExcerpt('un deux trois quatre cinq six', 16)).toBe('un deux trois…')
  })
})
