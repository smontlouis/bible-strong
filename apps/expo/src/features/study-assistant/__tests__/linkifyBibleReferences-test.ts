import {
  linkifyBibleReferences,
  passageOsisFromLink,
  PASSAGE_LINK_PREFIX,
} from '../linkifyBibleReferences'

jest.mock('~helpers/bcvParser', () => ({
  // A reference is any "Jean <chapter>:<verse>" in these tests.
  parseInlineBibleReferencesInAnyLanguage: (text: string) =>
    [...text.matchAll(/Jean (\d+):(\d+)/g)].map(match => ({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      target: { osis: `John.${match[1]}.${match[2]}` },
    })),
}))

const link = (text: string, osis: string) => `[${text}](${PASSAGE_LINK_PREFIX}${osis})`

describe('Bible references in native Markdown', () => {
  it('turns a reference in prose into a passage link', () => {
    expect(linkifyBibleReferences('Voir Jean 3:16 et Jean 15:4.')).toBe(
      `Voir ${link('Jean 3:16', 'John.3.16')} et ${link('Jean 15:4', 'John.15.4')}.`
    )
  })

  it('leaves existing links, code and bare addresses untouched', () => {
    const cited = '[Jean 3:16](https://bible-strong.app/assistant-source/s1)'
    expect(linkifyBibleReferences(cited)).toBe(cited)
    expect(linkifyBibleReferences('`Jean 3:16`')).toBe('`Jean 3:16`')
    expect(linkifyBibleReferences('```\nJean 3:16\n```')).toBe('```\nJean 3:16\n```')
    expect(linkifyBibleReferences('https://example.com/?q=Jean 3:16')).toBe(
      'https://example.com/?q=Jean 3:16'
    )
  })

  it('does not link inside a link that is still being streamed', () => {
    expect(linkifyBibleReferences('Texte [Jean 3:16')).toBe('Texte [Jean 3:16')
  })

  it('reads the passage back from its link only', () => {
    expect(passageOsisFromLink(`${PASSAGE_LINK_PREFIX}John.3.16`)).toBe('John.3.16')
    expect(passageOsisFromLink('https://bible-strong.app/assistant-source/s1')).toBeUndefined()
    expect(passageOsisFromLink(`${PASSAGE_LINK_PREFIX}%E0%A4%A`)).toBeUndefined()
  })
})
