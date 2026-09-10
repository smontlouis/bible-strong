import { useStrongRouteNavigation } from '../useStrongRouteNavigation'
const mockPush = jest.fn()
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => mockPush }))
jest.mock('~helpers/bibleBookCatalog', () => ({
  getBook: (Numero: number) => ({ Numero, Nom: 'Jean', Chapitres: 21 }),
}))
jest.mock('../strongDetailRoutes', () => ({ createStrongDetailRoute: jest.fn() }))
jest.mock('../strongReferenceNavigation', () => ({
  getBibleViewRouteForStrongOsisReference: jest.fn(),
}))
it('opens a concordance verse directly with its version and Strong mode', () => {
  const navigation = useStrongRouteNavigation({})
  navigation.openConcordanceVerse(
    { Livre: '43', Chapitre: '3', Verset: '16', Texte: 'Texte' },
    'KJV'
  )
  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/bible-view',
    params: {
      contextDisplayMode: 'focused',
      book: JSON.stringify({ Numero: 43, Nom: 'Jean', Chapitres: 21 }),
      chapter: '3',
      verse: '16',
      focusVerses: '[16]',
      version: 'KJV',
      strongMode: 'visible',
    },
  })
})
