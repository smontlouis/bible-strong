import { describe, expect, it } from 'vitest'
import { convertStudyOpsToHtml, readStudyVerseIds } from './helpers.study'
import type { StudyEntityEmbedPayload } from './study-entities'

const SCRIPT = '"><img src=x onerror=alert(1)>'

describe('HTML of a published study', () => {
  it('escapes every value of a block verse', () => {
    const html = convertStudyOpsToHtml([
      {
        insert: {
          'block-verse': {
            title: `Jean 3:16${SCRIPT}`,
            content: '<script>alert(1)</script>Car Dieu a tant aimé le monde',
            version: SCRIPT,
            verses: ['43-3-16', SCRIPT],
          },
        },
      },
    ])

    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('data-verses="43-3-16"')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;Car Dieu a tant aimé le monde')
    expect(html).toContain('Jean 3:16&quot;&gt;&lt;img')
  })

  it('escapes a Strong block and keeps only the formatting of its definition', () => {
    const html = convertStudyOpsToHtml([
      {
        insert: {
          'block-strong': {
            title: SCRIPT,
            codeStrong: `26${SCRIPT}`,
            book: SCRIPT,
            phonetique: SCRIPT,
            original: SCRIPT,
            definition: '<p onclick="x()">aimer <b>beaucoup</b></p><script>alert(1)</script>',
          },
        },
      },
    ])

    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick')
    expect(html).toContain('data-code="26&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
    expect(html).toContain('<p>aimer <b>beaucoup</b></p>alert(1)')
  })

  it('escapes the attributes of inline verses, Strong words and entities', () => {
    const entity: StudyEntityEmbedPayload = {
      schemaVersion: 1,
      endpoint: { type: 'dictionary', word: 'Grâce' },
      fallback: { typeLabel: 'Dictionnaire', title: 'Grâce' },
      display: { typeLabel: 'Dictionnaire', title: `Grâce${SCRIPT}` },
    }
    const html = convertStudyOpsToHtml([
      {
        insert: 'Jean 3:16',
        attributes: { 'inline-verse': { title: SCRIPT, verses: [`43-3-16${SCRIPT}`, '43-3-17'] } },
      },
      {
        insert: 'agapè',
        attributes: { 'inline-strong': { title: SCRIPT, codeStrong: SCRIPT, book: SCRIPT } },
      },
      { insert: 'grâce', attributes: { 'inline-entity': entity } },
      { insert: '\n' },
    ])

    expect(html).not.toContain('<img')
    expect(html).not.toMatch(/="[^"]*"><img/u)
    expect(html).toContain('data-verses="43-3-17"')
    expect(html).toContain('title="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
    expect(html).toContain('title="Dictionnaire — Grâce&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
  })

  it('escapes the name of an embed it does not know', () => {
    const html = convertStudyOpsToHtml([{ insert: { '<img src=x onerror=alert(1)>': true } }])

    expect(html).toContain('<div>&lt;img src=x onerror=alert(1)&gt;</div>')
  })

  it('drops mentions, whose text and address the converter writes as they are', () => {
    const html = convertStudyOpsToHtml([
      {
        insert: '<img src=x onerror=alert(1)>',
        attributes: {
          mentions: true,
          mention: { 'end-point': 'https://example.com', slug: SCRIPT },
        },
      },
    ])

    expect(html).not.toContain('<img')
    expect(html).not.toContain('href')
  })

  it('neutralizes links to scripts and frames only the players the editor embeds', () => {
    const html = convertStudyOpsToHtml([
      { insert: 'lien', attributes: { link: 'javascript:alert(1)' } },
      { insert: 'image', attributes: { link: ' javascript:alert(1)' } },
      { insert: { video: 'https://example.com/phishing' } },
      { insert: { video: 'javascript:alert(1)' } },
      { insert: { video: 'https://www.youtube.com/embed/dQw4w9WgXcQ' } },
      { insert: { image: 'javascript:alert(1)' } },
      { insert: '\n' },
    ])

    expect(html).not.toMatch(/(?:href|src)="javascript:/u)
    expect(html).not.toContain('example.com')
    expect(html).toContain('src="https://www.youtube.com/embed/dQw4w9WgXcQ"')
    expect(html).toContain('rel="noopener"')
  })
})

describe('Verses an inline or block verse names', () => {
  it('reads a list, or the JSON of one', () => {
    expect(readStudyVerseIds(['43-3-16', '43-3-17'])).toEqual(['43-3-16', '43-3-17'])
    expect(readStudyVerseIds('["1-1-1","1-1-2"]')).toEqual(['1-1-1', '1-1-2'])
    expect(readStudyVerseIds('1-1-1,1-1-2')).toEqual(['1-1-1', '1-1-2'])
  })

  it.each([undefined, null, 3, {}, ['a"b', '../x', '1-1'], '"]'])('leaves out %j', value => {
    expect(readStudyVerseIds(value)).toEqual([])
  })
})
