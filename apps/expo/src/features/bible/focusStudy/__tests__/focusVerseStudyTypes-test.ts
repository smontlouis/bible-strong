import { isFocusStudyAction } from '../focusVerseStudyTypes'

describe('isFocusStudyAction', () => {
  it('accepts the taps of the study under a verse in focus', () => {
    expect(isFocusStudyAction({ kind: 'study-verse', verse: 16 })).toBe(true)
    expect(isFocusStudyAction({ kind: 'open-resource', resource: 'commentary' })).toBe(true)
    expect(isFocusStudyAction({ kind: 'open-reference', verseKey: '42-5-29' })).toBe(true)
    expect(
      isFocusStudyAction({ kind: 'open-word', identityKind: 'greek', identityCode: 'G1803' })
    ).toBe(true)
    expect(
      isFocusStudyAction({ kind: 'open-topic', name: 'Béthanie', nameLower: 'bethanie' })
    ).toBe(true)
    expect(
      isFocusStudyAction({
        kind: 'open-dictionary',
        entry: { word: 'Lazare', entryId: 12, work: 'westphal', resourceId: 'westphal-fr' },
      })
    ).toBe(true)
  })

  it('refuses what the reader cannot act on', () => {
    expect(isFocusStudyAction(undefined)).toBe(false)
    expect(isFocusStudyAction({ kind: 'study-verse', verse: '16' })).toBe(false)
    expect(isFocusStudyAction({ kind: 'open-resource', resource: 'timeline' })).toBe(false)
    expect(isFocusStudyAction({ kind: 'open-reference', verseKey: 'Jean 3:16' })).toBe(false)
    expect(isFocusStudyAction({ kind: 'open-dictionary', entry: { word: 'Lazare' } })).toBe(false)
    expect(isFocusStudyAction({ kind: 'delete-everything' })).toBe(false)
  })
})
