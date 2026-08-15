import { getBibleRelatedPublicationResources } from '../bibleRelatedPublications'

describe('Bible related publication resources', () => {
  it('does not expose canonical extras as separate publications', () => {
    expect(getBibleRelatedPublicationResources('DBY')).toEqual([])
  })

  it('does not expose bundled legacy extras as separate publications', () => {
    expect(getBibleRelatedPublicationResources('CHU')).toEqual([])
    expect(getBibleRelatedPublicationResources('BCC1923')).toEqual([])
  })
})
