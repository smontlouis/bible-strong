import type { ReadingSlice } from '~common/types'
import { resolveMeditationOpening } from '../meditationPassage'

jest.mock('../../../../i18n', () => ({ getLanguage: () => 'fr' }))

const entry = (text: string): ReadingSlice => ({
  id: 'day',
  slices: [{ id: 'opening', type: 'Text', subType: 'devotional', description: text }],
})

describe('daily opening passage', () => {
  it('separates a trailing French reference and publisher locator using the real parser', () => {
    const text = 'Sanctifie-les par ta vérité: ta parole est la vérité. Jean 17:17.\nAD 275.1'
    const result = resolveMeditationOpening(entry(text), 'fr')
    expect(result?.quote).toBe('Sanctifie-les par ta vérité: ta parole est la vérité.')
    expect(result?.reference).toBe('Jean 17:17')
    expect(result?.target).toMatchObject({ book: 43, chapter: 17, verse: 17 })
    expect(result?.editorialCitation).toBe('AD 275.1')
    expect(result?.source).toBe(text)
    expect(result?.text).toBe('Sanctifie-les par ta vérité: ta parole est la vérité. Jean 17:17.')
  })

  it('preserves an English quotation and a range without replacing its Bible version', () => {
    const result = resolveMeditationOpening(
      entry('A quotation kept in its original wording. (Romans 8:38-39)'),
      'en'
    )
    expect(result?.quote).toBe('A quotation kept in its original wording.')
    expect(result?.reference).toBe('Romans 8:38-39')
    expect(result?.target?.focusVerses).toEqual([38, 39])
  })

  it('keeps multiple embedded references intact instead of inventing one passage', () => {
    const text = 'First passage: Jean 3:16. Another passage: Romains 5:1.'
    const result = resolveMeditationOpening(entry(text), 'fr')
    expect(result?.quote).toBe(text)
    expect(result?.reference).toBeUndefined()
    expect(result?.target).toBeUndefined()
  })

  it('does not cut a reference out of the middle of a quotation', () => {
    const text = 'Jean 3:16 est le passage qui ouvre cette réflexion.'
    expect(resolveMeditationOpening(entry(text), 'fr')?.quote).toBe(text)
  })

  it('keeps an unrecognized reference and rejects an empty or ambiguous opening', () => {
    const text = 'A quotation, with an editorial reference we cannot recognize.'
    expect(resolveMeditationOpening(entry(text), 'en')?.quote).toBe(text)
    expect(resolveMeditationOpening(entry(''), 'fr')).toBeUndefined()
    const reading = entry(text)
    expect(
      resolveMeditationOpening({ slices: [...reading.slices, ...reading.slices] }, 'fr')
    ).toBeUndefined()
  })
})
