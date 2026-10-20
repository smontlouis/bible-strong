/* eslint-disable import/first */

jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))

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

  it('selects BHG in simple mode before its optional interlinear index is enabled', () => {
    expect(
      selectBibleTabVersion(
        { selectedVersion: 'LSG' } as Parameters<typeof selectBibleTabVersion>[0],
        'BHG'
      )
    ).toMatchObject({
      selectedVersion: 'BHG',
      interlinearMode: 'hidden',
    })
  })
})
