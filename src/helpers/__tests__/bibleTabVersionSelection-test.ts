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

  it('maps the removed legacy KJVS selection to KJV with Strong visible', () => {
    expect(
      selectBibleTabVersion(
        { selectedVersion: 'KJVS' } as Parameters<typeof selectBibleTabVersion>[0],
        'KJVS'
      )
    ).toMatchObject({
      selectedVersion: 'KJV',
      strongMode: 'visible',
    })
  })

  it('preserves an acquisition transaction while another version is selected', () => {
    const data = {
      selectedVersion: 'DBY',
      strongMode: 'hidden',
      pendingModeAcquisition: {
        kind: 'strong',
        versionId: 'DBY',
        mode: 'visible',
        planIds: ['bible-strong:DBY'],
      },
    } as Parameters<typeof selectBibleTabVersion>[0]

    expect(selectBibleTabVersion(data, 'BFC')).toMatchObject({
      selectedVersion: 'BFC',
      strongMode: 'hidden',
      pendingModeAcquisition: {
        kind: 'strong',
        versionId: 'DBY',
        mode: 'visible',
        planIds: ['bible-strong:DBY'],
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

  it('keeps legacy interlinear versions addressable for persisted tabs', () => {
    expect(
      selectBibleTabVersion(
        { selectedVersion: 'INT' } as Parameters<typeof selectBibleTabVersion>[0],
        'INT'
      )
    ).toMatchObject({
      selectedVersion: 'INT',
    })
  })
})
