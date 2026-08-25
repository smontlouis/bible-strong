import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import BibleVerseDetailCard from '../BibleVerseDetailCard'

const mockLoadVerse = jest.fn()
const mockLoadEntries = jest.fn()
const mockLoadCoverage = jest.fn()
const mockGetModuleAvailability = jest.fn()
const mockGetModuleRecoveryActions = jest.fn()
const mockScrollTo = jest.fn()
const mockResourceAccess = {
  bibleContent: { loadCoverage: mockLoadCoverage },
  lexiconBible: { loadVerse: mockLoadVerse },
  strongLexicon: {
    loadEntryCards: mockLoadEntries,
    getModuleAvailability: mockGetModuleAvailability,
    getModuleRecoveryActions: mockGetModuleRecoveryActions,
  },
}
let queryClient: QueryClient

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
    View: createStyledComponent('View'),
    TouchableOpacity: createStyledComponent('TouchableOpacity'),
  })

  return { __esModule: true, default: styled }
})

jest.mock('@emotion/react', () => ({
  useTheme: () => ({ colors: { default: '#000' } }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { version?: string }) =>
      values?.version ? key.replace('{{version}}', values.version) : key,
  }),
}))

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        bible: {
          settings: {
            defaultStrongBibleVersionId: 'LSG',
            fontSizeScale: 1,
            lineHeight: 'large',
          },
        },
      },
    }),
}))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const ScrollView = ReactModule.forwardRef(
    (
      { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.ForwardedRef<{ scrollTo: typeof mockScrollTo }>
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }))
      return ReactModule.createElement('ScrollView', props, children)
    }
  )
  return {
    ScrollView,
  }
})

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('../StrongResourceScrollContext', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    StrongResourceScrollProvider: ({
      children,
      value,
    }: React.PropsWithChildren<{ value: unknown }>) =>
      ReactModule.createElement('StrongResourceScrollProvider', { value }, children),
  }
})

jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => mockResourceAccess,
}))

jest.mock('~features/resources/OfflineResourceRecovery', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return () => ReactModule.createElement('OfflineResourceRecovery')
})
jest.mock('~features/resources/ResourceUnavailableView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) =>
    ReactModule.createElement('ResourceUnavailableView', props)
})

jest.mock('~state/resourcesLanguage', () => ({
  useResourcesLanguageValue: () => ({ STRONG: 'fr' }),
}))

jest.mock('../CanonicalStrongVerseText', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ verse, textStyle }: { verse: { Texte: string }; textStyle?: unknown }) =>
    ReactModule.createElement('CanonicalStrongVerseText', { textStyle }, verse.Texte)
})

jest.mock('~helpers/bibleCoverage', () => ({
  getChapterVerseCountFromCoverage: (
    coverage: { verseCountByBookChapter?: Record<string, number> } | undefined,
    book: number,
    chapter: number
  ) => coverage?.verseCountByBookChapter?.[`${book}-${chapter}`],
}))

jest.mock('~helpers/useLayoutSize', () => ({
  useLayoutSize: () => ({
    ref: { current: null },
    size: { width: 320, height: 400 },
    onLayout: jest.fn(),
  }),
}))

jest.mock('~helpers/utils', () => ({
  wp: (value: number) => value,
}))

jest.mock('~helpers/strongBiblePublications', () => ({
  STRONG_BIBLE_FALLBACK_PRIORITY: ['LSG', 'DBY', 'DBR'],
  FRENCH_STRONG_BIBLE_PRIORITY: ['LSG', 'DBY', 'DBR'],
  ENGLISH_STRONG_BIBLE_PRIORITY: ['KJV'],
  getStrongBibleFallbackPriority: () => ['LSG', 'DBY', 'DBR'],
}))

jest.mock('~common/Empty', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Empty', props, children)
})
jest.mock('~common/Loading', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return () => ReactModule.createElement('Loading')
})
jest.mock('~common/ui/Button', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Button', props, children),
  }
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Box', props, children),
  }
})
jest.mock('~common/ui/Container', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))
jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) =>
      ReactModule.createElement('FeatherIcon', props),
  }
})
jest.mock('~common/ui/Paragraph', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))
jest.mock('~common/ui/RoundedCorner', () => () => null)
jest.mock('~common/ui/Text', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))
jest.mock('../BibleVerseDetailFooter', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return () => ReactModule.createElement('VerseFooter')
})
jest.mock('../StrongCard', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('StrongCard', props)
})

const makeAvailableVerse = (
  text: string,
  strongSpans?: {
    ordinal: number
    startOffset: number
    length: number
    identities: { kind: 'strong'; code: string }[]
    morphologies?: {
      identity: { kind: 'strong'; code: string }
      codes: string[]
    }[]
  }[]
) => ({
  status: 'available' as const,
  verse: { Texte: text, StrongSpans: strongSpans },
  provenance: {
    versionId: 'DBY' as const,
    datasetId: 'DBY' as const,
    textRevision: 'test',
    textSha256: 'test',
  },
})

const flushQueryUpdates = async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

const renderCard = (
  verseNumber: number,
  onOpenStrongBibleSourceSheet = jest.fn(),
  onStrongBibleProvenanceChange = jest.fn(),
  selectedVersion: 'BFC' | 'BHG' = 'BFC'
) => (
  <QueryClientProvider client={queryClient}>
    <BibleVerseDetailCard
      verse={{ Livre: 1, Chapitre: 1, Verset: verseNumber }}
      selectedVersion={selectedVersion}
      preferredInterlinearLocale="fr"
      updateVerse={jest.fn()}
      onOpenStrongBibleSourceSheet={onOpenStrongBibleSourceSheet}
      onStrongBibleProvenanceChange={onStrongBibleProvenanceChange}
    />
  </QueryClientProvider>
)

describe('BibleVerseDetailCard', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, networkMode: 'always' },
      },
    })
    mockLoadEntries.mockResolvedValue([
      {
        baseCode: 430,
        stepCode: 'H0430',
        selectedIdentity: { kind: 'strong', code: 'H0430' },
        language: 'hebrew',
        original: 'אֱלֹהִים',
        transliteration: 'Elohim',
        gloss: 'Dieu',
      },
    ])
    mockLoadCoverage.mockResolvedValue({
      books: [1],
      chaptersByBook: { 1: [1] },
      verseCountByBookChapter: { '1-1': 31 },
    })
    mockGetModuleAvailability.mockResolvedValue({ status: 'available' })
    mockGetModuleRecoveryActions.mockResolvedValue([])
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    queryClient.clear()
    consoleError.mockRestore()
  })

  it('keeps the displayed Strong verse while the next verse is loading', async () => {
    let resolveNextVerse: (value: ReturnType<typeof makeAvailableVerse>) => void = () => undefined
    const nextVerse = new Promise<ReturnType<typeof makeAvailableVerse>>(resolve => {
      resolveNextVerse = resolve
    })
    mockLoadVerse
      .mockResolvedValueOnce(makeAvailableVerse('Ancien verset'))
      .mockReturnValueOnce(nextVerse)

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1))
      await flushQueryUpdates()
    })
    expect(JSON.stringify(renderer.toJSON())).toContain('Ancien verset')

    await act(async () => {
      renderer.update(renderCard(2))
      await flushQueryUpdates()
    })

    const pendingTree = JSON.stringify(renderer.toJSON())
    expect(pendingTree).toContain('Ancien verset')
    expect(pendingTree).not.toContain('"type":"Loading"')

    await act(async () => {
      resolveNextVerse(makeAvailableVerse('Nouveau verset'))
      await nextVerse
      await flushQueryUpdates()
    })
    const loadedTree = JSON.stringify(renderer.toJSON())
    expect(loadedTree).toContain('Nouveau verset')
    expect(loadedTree).not.toContain('Ancien verset')
  })

  it('does not duplicate the selected Strong Bible below the header', async () => {
    mockLoadVerse.mockResolvedValueOnce(makeAvailableVerse('Verset'))

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })

    expect(JSON.stringify(renderer.toJSON())).not.toContain('Strong fourni par DBY')
  })

  it('wraps the verse at the Bible font size and caps its vertical scroll area', async () => {
    mockLoadVerse.mockResolvedValueOnce(makeAvailableVerse('Un verset très long'))

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1))
      await flushQueryUpdates()
    })

    const content = renderer.root.findByProps({ testID: 'resource-modal-content' })
    act(() => content.props.onLayout({ nativeEvent: { layout: { height: 800 } } }))

    const verseScroll = renderer.root.findByProps({ testID: 'resource-verse-scroll' })
    expect(verseScroll.props.horizontal).toBeUndefined()
    expect(verseScroll.props.showsVerticalScrollIndicator).toBe(false)
    expect(verseScroll.props.style).toEqual({ maxHeight: 320 })
    expect(renderer.root.findByProps({ testID: 'resource-verse-text' }).props).toEqual(
      expect.objectContaining({ flex: 1, row: true, wrap: true })
    )
    const renderedVerse = renderer.root.find(
      node => String(node.type) === 'CanonicalStrongVerseText'
    )
    expect(renderedVerse.props.textStyle).toEqual({
      fontSize: 20.9,
      lineHeight: 37,
    })
  })

  it('passes the contextual word and morphology to the ResourceModal Strong card', async () => {
    mockLoadVerse.mockResolvedValueOnce(
      makeAvailableVerse('Dieu créa', [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
          morphologies: [
            {
              identity: { kind: 'strong', code: 'H0430' },
              codes: ['HNcmpa'],
            },
          ],
        },
      ])
    )

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1))
      await flushQueryUpdates()
    })

    const strongCard = renderer.root.find(node => String(node.type) === 'StrongCard')
    expect(strongCard.props).toEqual(
      expect.objectContaining({
        strongVerseContext: {
          bibleVersion: 'DBY',
          strongBibleVersionId: 'DBY',
          book: 1,
          bibleChapter: 1,
          bibleVerse: 1,
          clickedWord: 'Dieu',
          morphologyCodes: ['HNcmpa'],
        },
      })
    )
  })

  it('renders Strong cards in the horizontally snapping resource area', async () => {
    mockLoadVerse.mockResolvedValueOnce(
      makeAvailableVerse('Dieu', [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
      ])
    )

    await act(async () => {
      renderer = create(renderCard(1, jest.fn(), jest.fn(), 'BFC'))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1, jest.fn(), jest.fn(), 'BFC'))
      await flushQueryUpdates()
    })

    const cardsScrollView = renderer.root
      .findAll(node => String(node.type) === 'ScrollView')
      .find(node => node.props.snapToInterval === 64)
    expect(cardsScrollView).toBeDefined()
    expect(renderer.root.find(node => String(node.type) === 'StrongCard')).toBeDefined()
  })

  it('renders repeated Strong words as distinct cards with occurrence morphology', async () => {
    mockLoadVerse.mockResolvedValueOnce(
      makeAvailableVerse('Dieu Dieu', [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
          morphologies: [{ identity: { kind: 'strong', code: 'H0430' }, codes: ['HNcmpa'] }],
        },
        {
          ordinal: 1,
          startOffset: 5,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
          morphologies: [{ identity: { kind: 'strong', code: 'H0430' }, codes: ['HVqp3ms'] }],
        },
      ])
    )

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1))
      await flushQueryUpdates()
    })

    const strongCards = renderer.root.findAll(node => String(node.type) === 'StrongCard')
    expect(strongCards).toHaveLength(2)
    expect(strongCards.map(card => card.props.strongVerseContext.morphologyCodes)).toEqual([
      ['HNcmpa'],
      ['HVqp3ms'],
    ])
  })

  it('scrolls the horizontal cards list to the tapped verse occurrence', async () => {
    mockLoadVerse.mockResolvedValueOnce(
      makeAvailableVerse('Dieu Dieu', [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
        {
          ordinal: 1,
          startOffset: 5,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
      ])
    )

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1))
      await flushQueryUpdates()
    })
    mockScrollTo.mockClear()

    const provider = renderer.root.find(
      node => String(node.type) === 'StrongResourceScrollProvider'
    )
    act(() => provider.props.value.scrollToStrongCard('430', 1))

    expect(mockScrollTo).toHaveBeenCalledWith({ x: 64, animated: true })
  })

  it('scrolls the wrapped verse vertically to the occurrence selected from the Strong cards', async () => {
    mockLoadVerse.mockResolvedValueOnce(
      makeAvailableVerse('Dieu Dieu', [
        {
          ordinal: 0,
          startOffset: 0,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
        {
          ordinal: 1,
          startOffset: 5,
          length: 4,
          identities: [{ kind: 'strong', code: 'H0430' }],
        },
      ])
    )

    await act(async () => {
      renderer = create(renderCard(1))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1))
      await flushQueryUpdates()
    })

    const provider = renderer.root.find(
      node => String(node.type) === 'StrongResourceScrollProvider'
    )
    const cardsScrollView = renderer.root
      .findAll(node => String(node.type) === 'ScrollView')
      .find(node => node.props.snapToInterval === 64)
    act(() => provider.props.value.registerStrongWordLayout(1, 180))
    mockScrollTo.mockClear()
    act(() => cardsScrollView?.props.onScroll({ nativeEvent: { contentOffset: { x: 64 } } }))

    expect(mockScrollTo).toHaveBeenCalledWith({ y: 180, animated: true })
  })

  it('requests the contextual BHG lexicon source with the tab interlinear locale', async () => {
    mockLoadVerse.mockResolvedValueOnce(makeAvailableVerse('Verset'))

    await act(async () => {
      renderer = create(renderCard(1, jest.fn(), jest.fn(), 'BHG'))
      await flushQueryUpdates()
    })

    expect(mockLoadVerse).toHaveBeenCalledWith(
      expect.objectContaining({
        currentVersionId: 'BHG',
        preferredInterlinearLocale: 'fr',
      })
    )
  })

  it('offers the Strong Bible selector when no Strong Bible is available', async () => {
    const openStrongBibleSourceSheet = jest.fn()
    mockLoadVerse.mockResolvedValueOnce({ status: 'unavailable', attempts: [] })

    await act(async () => {
      renderer = create(renderCard(1, openStrongBibleSourceSheet))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1, openStrongBibleSourceSheet))
      await flushQueryUpdates()
    })

    expect(renderer.root.findByProps({ message: 'strongSource.unavailableMessage' })).toBeDefined()
    expect(renderer.root.findByProps({ onPress: openStrongBibleSourceSheet }).props.children).toBe(
      'strongSource.chooseAction'
    )

    act(() => {
      renderer.root.findByProps({ onPress: openStrongBibleSourceSheet }).props.onPress()
    })
    expect(openStrongBibleSourceSheet).toHaveBeenCalledTimes(1)
  })

  it('shows an empty lexicon state when the verse is outside the Strong index', async () => {
    const openStrongBibleSourceSheet = jest.fn()
    mockLoadVerse.mockResolvedValueOnce({
      status: 'missing-location',
      provenance: { versionId: 'LSG', datasetId: 'strong-lsg', isFallback: false },
    })

    await act(async () => {
      renderer = create(renderCard(6, openStrongBibleSourceSheet))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(6, openStrongBibleSourceSheet))
      await flushQueryUpdates()
    })

    expect(
      renderer.root.findByProps({ message: 'resource.strong.noLexiconForVerse' })
    ).toBeDefined()
    expect(openStrongBibleSourceSheet).not.toHaveBeenCalled()
  })

  it('keeps the displayed Strong verse when the next verse cannot be loaded', async () => {
    const onStrongBibleProvenanceChange = jest.fn()
    mockLoadVerse
      .mockResolvedValueOnce(makeAvailableVerse('Verset conservé'))
      .mockResolvedValueOnce({ status: 'unavailable', attempts: [] })

    await act(async () => {
      renderer = create(renderCard(1, jest.fn(), onStrongBibleProvenanceChange))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(1, jest.fn(), onStrongBibleProvenanceChange))
      await flushQueryUpdates()
    })
    await act(async () => {
      renderer.update(renderCard(2, jest.fn(), onStrongBibleProvenanceChange))
      await flushQueryUpdates()
    })

    const failedTree = JSON.stringify(renderer.toJSON())
    expect(failedTree).toContain('Verset conservé')
    expect(failedTree).not.toContain('"type":"Empty"')
    expect(onStrongBibleProvenanceChange).toHaveBeenCalledWith(
      expect.objectContaining({ versionId: 'DBY' })
    )
    expect(onStrongBibleProvenanceChange).not.toHaveBeenCalledWith(null)
  })
})
