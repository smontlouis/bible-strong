import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import VerseComponent from '../Verse'

const mockPushRouteOnce = jest.fn()

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    TouchableOpacity: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableOpacity', props, children),
  }
})

jest.mock('@emotion/native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const createStyledComponent = (type: React.ElementType | string) => () =>
    function StyledComponent({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(type as React.ElementType, props, children)
    }
  const styled = Object.assign((type: React.ElementType) => createStyledComponent(type), {
    Text: createStyledComponent('Text'),
    View: createStyledComponent('View'),
  })
  return { __esModule: true, default: styled }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'bibleVerse.textUnavailableInstalled'
        ? 'Texte indisponible dans les Bibles installées.'
        : key,
  }),
}))

jest.mock('date-fns/formatDistance', () => jest.fn(() => 'un instant'))
jest.mock('~helpers/useBibleVerses', () => ({
  useResolvedBibleVerses: () => ({
    verses: [],
    version: undefined,
    status: 'reference-only',
    missingVerseKeys: ['67-1-1'],
    isLoading: false,
  }),
}))
jest.mock('~helpers/formatVerseContent', () => ({
  __esModule: true,
  default: (verses: { Texte?: string }[]) => ({
    title: 'Tobie 1:1',
    content: verses
      .map(verse => verse.Texte || '')
      .join(' ')
      .trim(),
  }),
}))
jest.mock('~helpers/bibleBookCatalog', () => ({
  getBook: (book: number) => ({ Numero: book, Nom: 'Tobie', Chapitres: 14 }),
}))
jest.mock('~helpers/useLanguage', () => ({ __esModule: true, default: () => 'fr' }))
jest.mock('~helpers/languageUtils', () => ({ getDateLocale: () => undefined }))
jest.mock('~helpers/utils', () => ({ removeBreakLines: (value: string) => value }))
jest.mock('~helpers/truncate', () => ({ __esModule: true, default: (value: string) => value }))
jest.mock('~helpers/useHighlightColors', () => ({
  useHighlightColors: () => ({ customHighlightColors: [], defaultColorTypes: {} }),
  useResolvedColor: () => '#ffff00',
}))
jest.mock('~navigation/usePushRouteOnce', () => ({
  usePushRouteOnce: () => mockPushRouteOnce,
}))

jest.mock('~common/EntityChipList', () => () => null)
jest.mock('~common/HighlightTypeIndicator', () => () => null)
jest.mock('~common/Link', () => ({
  LinkBox: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Box', props, children),
  }
})
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})
jest.mock('~common/ui/Paragraph', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Paragraph', props, children),
  }
})

const renderVerse = () => {
  let renderer: ReactTestRenderer
  const consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
      return
    }
    console.warn(message, ...args)
  })

  try {
    act(() => {
      renderer = create(
        <VerseComponent
          color="color1"
          date={1}
          verseIds={[{ Livre: 67, Chapitre: 1, Verset: 1, Texte: '' }]}
          tags={{}}
        />
      )
    })
  } finally {
    consoleError.mockRestore()
  }

  return renderer!
}

describe('VerseComponent', () => {
  beforeEach(() => {
    mockPushRouteOnce.mockClear()
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('keeps a reference-only highlight visible and actionable', () => {
    const renderer = renderVerse()
    const renderedText = JSON.stringify(renderer.toJSON())

    expect(renderedText).toContain('Tobie 1:1')
    expect(renderedText).toContain('Texte indisponible dans les Bibles installées.')

    act(() => {
      renderer.root.findByType('TouchableOpacity' as never).props.onPress()
    })
    expect(mockPushRouteOnce).toHaveBeenCalledWith({
      pathname: '/bible-view',
      params: expect.objectContaining({
        chapter: '1',
        verse: '1',
        focusVerses: '[1]',
      }),
    })
  })
})
