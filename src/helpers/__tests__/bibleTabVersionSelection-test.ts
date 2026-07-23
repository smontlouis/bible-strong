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

  it('maps the legacy LSGS selection to LSG with Strong visible', () => {
    expect(
      selectBibleTabVersion(
        { selectedVersion: 'LSGS' } as Parameters<typeof selectBibleTabVersion>[0],
        'LSGS'
      )
    ).toMatchObject({
      selectedVersion: 'LSG',
      strongMode: 'visible',
    })
  })
})
