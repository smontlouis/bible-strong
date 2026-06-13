import { getStrongReferenceFamily } from '../strongAccessModel'

describe('StrongAccess', () => {
  it('maps Old Testament books to Hebrew references', () => {
    expect(getStrongReferenceFamily(1)).toBe('hebrew')
    expect(getStrongReferenceFamily(39)).toBe('hebrew')
  })

  it('maps New Testament books to Greek references', () => {
    expect(getStrongReferenceFamily(40)).toBe('greek')
    expect(getStrongReferenceFamily(66)).toBe('greek')
  })
})
