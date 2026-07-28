/* eslint-disable import/first */
jest.mock('../pericopes', () => ({
  getPericopeUrl: (versionId: string) => `pericope:${versionId}`,
  versionHasPericope: (versionId: string) => versionId === 'BCC1923',
}))
jest.mock('../redWords', () => ({
  getRedWordsUrl: (versionId: string) => `red-words:${versionId}`,
  versionHasRedWords: (versionId: string) => ['DBY', 'CHU', 'BCC1923'].includes(versionId),
}))
jest.mock('../strongBiblePublications', () => ({
  usesCanonicalBibleExtras: (versionId: string) => versionId === 'DBY',
}))

import { getBibleRelatedPublicationResources } from '../bibleRelatedPublications'

describe('Bible related publication resources', () => {
  it('does not request legacy extras already embedded in canonical DBY', () => {
    expect(getBibleRelatedPublicationResources('DBY')).toEqual([])
  })

  it('keeps standalone extras for legacy JSON Bibles', () => {
    expect(getBibleRelatedPublicationResources('CHU').map(resource => resource.resourceId)).toEqual(
      ['bible-red-words:CHU']
    )
    expect(
      getBibleRelatedPublicationResources('BCC1923').map(resource => resource.resourceId)
    ).toEqual(['bible-pericope:BCC1923', 'bible-red-words:BCC1923'])
  })
})
