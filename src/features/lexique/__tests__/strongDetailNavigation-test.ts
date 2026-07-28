import { resolveRelatedStrongNavigation } from '../strongDetailNavigation'

describe('resolveRelatedStrongNavigation', () => {
  it('pushes a new Strong route outside a tab', () => {
    expect(
      resolveRelatedStrongNavigation({
        isInTab: false,
        stepCode: 'G0026A',
        strongBibleVersionId: 'LSG',
        bibleVersion: 'BSB',
      })
    ).toEqual({
      mode: 'push-route',
      route: {
        pathname: '/strong',
        params: {
          book: '40',
          reference: 'G0026A',
          identityKind: 'dstrong',
          identityCode: 'G0026A',
          strongBibleVersionId: 'LSG',
          bibleVersion: 'BSB',
        },
      },
    })
  })

  it('updates the Strong tab state inside a tab', () => {
    expect(
      resolveRelatedStrongNavigation({
        isInTab: true,
        stepCode: 'H7965',
      })
    ).toEqual({
      mode: 'update-tab',
      identity: {
        book: 1,
        identityKind: 'dstrong',
        identityCode: 'H7965',
        reference: 'H7965',
      },
    })
  })
})
