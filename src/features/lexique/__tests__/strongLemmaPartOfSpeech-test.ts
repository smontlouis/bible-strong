import { formatStrongLemmaPartOfSpeech } from '../strongLemmaPartOfSpeech'

describe('Strong lemma part-of-speech labels', () => {
  it('uses compact labels for English lemma categories', () => {
    expect(formatStrongLemmaPartOfSpeech('name', 'en')).toBe('[N]')
    expect(formatStrongLemmaPartOfSpeech('noun', 'en')).toBe('[n]')
    expect(formatStrongLemmaPartOfSpeech('verb', 'en')).toBe('[v]')
    expect(formatStrongLemmaPartOfSpeech('det', 'en')).toBe('[det]')
    expect(formatStrongLemmaPartOfSpeech('prep', 'en')).toBe('[prep]')
    expect(formatStrongLemmaPartOfSpeech('particle', 'en')).toBe('[part]')
  })

  it('uses French abbreviations for French lemma categories', () => {
    expect(formatStrongLemmaPartOfSpeech('N', 'fr')).toBe('[N]')
    expect(formatStrongLemmaPartOfSpeech('n', 'fr')).toBe('[n]')
    expect(formatStrongLemmaPartOfSpeech('v', 'fr')).toBe('[v]')
    expect(formatStrongLemmaPartOfSpeech('j', 'fr')).toBe('[adj]')
    expect(formatStrongLemmaPartOfSpeech('d', 'fr')).toBe('[adv]')
    expect(formatStrongLemmaPartOfSpeech('J', 'fr')).toBe('[dét]')
    expect(formatStrongLemmaPartOfSpeech('é', 'fr')).toBe('[prép]')
  })

  it('keeps an unknown non-empty category visible', () => {
    expect(formatStrongLemmaPartOfSpeech(' custom ', 'fr')).toBe('[custom]')
    expect(formatStrongLemmaPartOfSpeech('', 'fr')).toBe('')
  })
})
