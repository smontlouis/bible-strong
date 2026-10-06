import { describe, expect, it } from 'vitest'
import { describeNaveTopic } from './naveHead'
import { renderNaveDescription } from './naveHtml'

const topics = new Set(['temperance', 'priest'])
const render = (html: string, language: 'fr' | 'en' = 'en') =>
  renderNaveDescription(html, { language, hasTopic: name => topics.has(name) })

describe('Nave topic outline', () => {
  it('reads the English lists, whose entries are not closed', () => {
    const outline = render(
      '<p><ul><li>FROM INTOXICATING BEVERAGES <br> <a href="v=3-10-8,9,10">Lévitique 10:8-10</a>; <a href="v=42-1-15">Luc 1:15</a> <p> <li>INSTANCES OF <ul> <li>Samson <br> <a href="v=7-16-17">Juges 16:17</a> <li> See <a href="w=temperance">TEMPERANCE</a> </ul> </FONT> </ul>'
    )
    expect(outline.html).toBe(
      '<ul>' +
        '<li><b>FROM INTOXICATING BEVERAGES</b><p><a href="/bible/kjv/lev/10/8-10">Leviticus 10:8-10</a>; <a href="/bible/kjv/luke/1/15">Luke 1:15</a></p></li>' +
        '<li><b>INSTANCES OF</b><ul>' +
        '<li><b>Samson</b><p><a href="/bible/kjv/judg/16/17">Judges 16:17</a></p></li>' +
        '<li><p>See <a href="/nave/en/temperance">TEMPERANCE</a></p></li>' +
        '</ul></li>' +
        '</ul>'
    )
    expect(outline.headings).toEqual(['FROM INTOXICATING BEVERAGES', 'INSTANCES OF'])
    expect(outline.referenceCount).toBe(3)
  })

  it('reads the French paragraphs, nested where the English lists are', () => {
    const outline = render(
      '<p>LES INSTANCES DE  <p>Isra&#xE9;lites dans le d&#xE9;sert <br> <a href="v=5-29-6">Deut&#xE9;ronome 29:6</a> </br></p><p> Voir <a href="w=temperance">La TEMP&#xC9;RANCE</a> </p>  </p><p>Caract&#xE8;re de <br> <a href="v=19-106-16">Psaumes 106:16</a> </br></p>',
      'fr'
    )
    expect(outline.html).toBe(
      '<ul>' +
        '<li><b>LES INSTANCES DE</b><ul>' +
        '<li><b>Isra&#xE9;lites dans le d&#xE9;sert</b><p><a href="/bible/lsg/deut/29/6">Deutéronome 29:6</a></p></li>' +
        '<li><p>Voir <a href="/nave/fr/temperance">La TEMP&#xC9;RANCE</a></p></li>' +
        '</ul></li>' +
        '<li><b>Caract&#xE8;re de</b><p><a href="/bible/lsg/ps/106/16">Psaumes 106:16</a></p></li>' +
        '</ul>'
    )
    expect(outline.headings).toEqual(['LES INSTANCES DE', 'Caractère de'])
  })

  it('links every run of a verse list and names books in the page language', () => {
    expect(
      render('<p><a href="v=13-6-3,4,5,50,51">1 Chroniques 6:3-5,50-51</a></p>', 'fr').html
    ).toBe(
      '<ul><li><p><a href="/bible/lsg/1chr/6/3-5">1 Chroniques 6:3-5</a>,<a href="/bible/lsg/1chr/6/50-51">50-51</a></p></li></ul>'
    )
    expect(render('<ul><li><a href="v=25-3-33">Lamentation de Jérémie 3:33</a></ul>').html).toBe(
      '<ul><li><p><a href="/bible/kjv/lam/3/33">Lamentations 3:33</a></p></li></ul>'
    )
  })

  it('drops a link that resolves to no site page and keeps its text', () => {
    const outline = render(
      '<ul><li>See <a href="w=hair">HAIR</a> <li>See <a href="view.cgi?n=1783">FAITH</A> <li><a href="v=99-1-1">Livre 1:1</a> <li><a href="javascript:alert(1)" onclick="x()">ici</a></ul>'
    )
    expect(outline.html).toBe(
      '<ul><li><p>See HAIR</p></li><li><p>See FAITH</p></li><li><p>Livre 1:1</p></li><li><p>ici</p></li></ul>'
    )
    expect(outline.referenceCount).toBe(0)
  })

  it('keeps in place what a list holds between two of its entries', () => {
    expect(
      render(
        '<ul><li>INSTANCES OF</B> <ul><li> By Matthew </li> - <a href="v=40-9-9">Matthieu 9:9</a> <li> By Peter </li> - <a href="v=40-4-18">Matthieu 4:18</a> </ul></p></ul>'
      ).html
    ).toBe(
      '<ul><li><b>INSTANCES OF</b><ul>' +
        '<li><b>By Matthew</b><p>- <a href="/bible/kjv/matt/9/9">Matthew 9:9</a></p></li>' +
        '<li><b>By Peter</b><p>- <a href="/bible/kjv/matt/4/18">Matthew 4:18</a></p></li>' +
        '</ul></li></ul>'
    )
  })

  it('makes one list of lists opened side by side or straight inside another', () => {
    expect(
      render(
        '<ul> <ul><li>By Rebekah <li> By Tamar </ul> <p> <li>See <a href="w=priest">PRIEST</a> </ul>'
      ).html
    ).toBe(
      '<ul><li><p>By Rebekah</p></li><li><p>By Tamar</p></li><li><p>See <a href="/nave/en/priest">PRIEST</a></p></li></ul>'
    )
    expect(render('<ul><li>A <ul><li>one</ul> <ul><li>two</ul></ul>').html).toBe(
      '<ul><li><b>A</b><ul><li><p>one</p></li><li><p>two</p></li></ul></li></ul>'
    )
  })

  it('emits nothing unsafe whatever the source holds', () => {
    expect(
      render('<ul><li><script>alert(1)</script> a < b <img src=x onerror=alert(1)></ul>').html
    ).toBe('<ul><li><p>alert(1) a &lt; b</p></li></ul>')
    expect(render('texte seul', 'fr').html).toBe('<p>texte seul</p>')
    expect(render('').html).toBe('')
  })
})

describe('Nave topic description', () => {
  it('counts the references and lists the first sub-topics', () => {
    expect(
      describeNaveTopic({
        language: 'fr',
        name: 'Aaron',
        headings: ['La lignée de', 'Le mariage de'],
        referenceCount: 77,
        text: '',
      })
    ).toBe('77 références bibliques sur le thème « Aaron » : La lignée de, Le mariage de')
    expect(
      describeNaveTopic({
        language: 'en',
        name: 'Abib',
        headings: [],
        referenceCount: 1,
        text: 'Exodus 13:4',
      })
    ).toBe('1 Bible reference on the topic “Abib”: Exodus 13:4')
  })

  it('describes a topic that only points elsewhere by its text', () => {
    expect(
      describeNaveTopic({
        language: 'en',
        name: 'Bag',
        headings: [],
        referenceCount: 0,
        text: 'See PURSE',
      })
    ).toBe('“Bag”, a topic of Nave’s Topical Bible: See PURSE')
  })

  it('never exceeds the length search engines show', () => {
    const description = describeNaveTopic({
      language: 'fr',
      name: 'Jésus, le Christ',
      headings: Array.from({ length: 40 }, (_, index) => `Sous-thème numéro ${index + 1}`),
      referenceCount: 2311,
      text: '',
    })
    expect(description.length).toBeLessThanOrEqual(155)
    expect(description.endsWith('…')).toBe(true)
  })
})
