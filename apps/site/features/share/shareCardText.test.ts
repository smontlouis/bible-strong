import { describe, expect, it } from 'vitest'
import { fitShareCardText } from './shareCardFit'
import { shareCardExcerpt, shareCardLine, shareCardVerse } from './shareCardText'
import { shareCardColor } from './shareCardTokens'

const words = (count: number) => Array.from({ length: count }, () => 'parole').join(' ')

describe('Share card text', () => {
  it('prints a verse whole when it fits', () => {
    expect(shareCardVerse('  Au commencement,\n Dieu créa.  ')).toBe('Au commencement, Dieu créa.')
  })

  it('cuts a verse too long for the smallest size at a word, without a dangling comma', () => {
    const cut = shareCardVerse(`${words(38)}, ${words(20)}`)
    expect(cut.length).toBeLessThanOrEqual(271)
    expect(cut.endsWith('parole…')).toBe(true)
  })

  it('keeps an excerpt shorter beside a picture', () => {
    const text = words(40)
    expect(shareCardExcerpt(text, true).length).toBeLessThan(shareCardExcerpt(text, false).length)
    expect(shareCardExcerpt('Voir Louange.', false)).toBe('Voir Louange.')
  })

  it('reads the text of a page as one line', () => {
    expect(shareCardLine('a\n\n b\tc')).toBe('a b c')
  })
})

describe('Share card drawing', () => {
  it('sets a short verse large and steps down as it gets longer', () => {
    expect(fitShareCardText(words(20))).toEqual({ fontSize: 52, lines: 4 })
    expect(fitShareCardText(words(28))).toEqual({ fontSize: 46, lines: 5 })
    expect(fitShareCardText(words(60))).toEqual({ fontSize: 38, lines: 6 })
  })

  it('takes the light value of a colour of the design system, its aliases followed', () => {
    expect(shareCardColor('canvas')).toBe('#f4f7ff')
    expect(shareCardColor('accent')).toBe('#5983f0')
    expect(() => shareCardColor('no-such-colour')).toThrow(/SHARE_CARD_COLOR_UNKNOWN/u)
  })
})
