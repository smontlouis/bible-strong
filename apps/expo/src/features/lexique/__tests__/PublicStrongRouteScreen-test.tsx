import { PublicStrongEntryRouteScreen } from '../PublicStrongRouteScreen'

let mockParams: Record<string, string> = {}
jest.mock('expo-router', () => ({
  Redirect: 'Redirect',
  useLocalSearchParams: () => mockParams,
}))
jest.mock('~features/resources/ResourceUnavailableView', () => 'ResourceUnavailableView')
jest.mock('~helpers/constants', () => ({ IS_FORM_SHEET: true }))
jest.mock('~features/app/PublicPage', () => 'PublicPage')
jest.mock('../StrongMainScreen', () => 'StrongMainScreen')
jest.mock('../StrongConcordanceRouteScreen', () => 'StrongConcordanceRouteScreen')
jest.mock('../StrongDictionaryRouteScreen', () => 'StrongDictionaryRouteScreen')
jest.mock('../StrongEntityRouteScreen', () => 'StrongEntityRouteScreen')
jest.mock('../StrongRelatedRouteScreen', () => 'StrongRelatedRouteScreen')

it.each(['index', 'dictionary', 'related', 'concordance'] as const)(
  'renders canonical suffix identities without redirecting on %s',
  page => {
    for (const code of ['h0802G', 'h2148V', 'h2148v', 'g3056']) {
      mockParams = { code }
      expect(PublicStrongEntryRouteScreen({ page }).type).toBe('PublicPage')
    }
  }
)

it('redirects a noncanonical code once and then renders, preserving verse context', () => {
  mockParams = { code: 'H802G', book: '1', bibleChapter: '3', bibleVerse: '2' }
  const redirect = PublicStrongEntryRouteScreen({ page: 'index' })
  expect(redirect.type).toBe('Redirect')
  expect(redirect.props.href).toEqual({
    pathname: '/strong/h0802G',
    params: { book: '1', bibleChapter: '3', bibleVerse: '2' },
  })
  mockParams = { ...redirect.props.href.params, code: 'h0802G' }
  expect(PublicStrongEntryRouteScreen({ page: 'index' }).type).toBe('PublicPage')
})
