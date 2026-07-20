import { selectBibleTabVersion } from '../bibleTabVersionSelection'

describe('selectBibleTabVersion', () => {
  it('makes an explicit user selection the preferred rendering for an entity tab', () => {
    const data = {
      selectedVersion: 'VUL',
      entityReference: {
        verseKeys: ['67-1-1'],
        preferredVersion: 'VUL',
      },
    } as Parameters<typeof selectBibleTabVersion>[0]

    expect(selectBibleTabVersion(data, 'KJV')).toMatchObject({
      selectedVersion: 'KJV',
      entityReference: {
        verseKeys: ['67-1-1'],
        preferredVersion: 'KJV',
      },
    })
  })
})
