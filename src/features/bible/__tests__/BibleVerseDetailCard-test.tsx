import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import BibleVerseDetailCard from '../BibleVerseDetailCard'

const mockLoadVerse = jest.fn()
const mockLoadEntries = jest.fn()
const mockResourceAccess = {
  lexiconBible: { loadVerse: mockLoadVerse },
  strongLexicon: { loadEntries: mockLoadEntries },
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
          settings: { defaultStrongBibleVersionId: 'LSG' },
        },
      },
    }),
}))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    ScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('ScrollView', props, children),
  }
})

jest.mock('react-native-reanimated-carousel', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ data }: { data: unknown[] }) =>
      ReactModule.createElement('Carousel', { itemCount: data.length }),
  }
})

jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => mockResourceAccess,
}))

jest.mock('~state/resourcesLanguage', () => ({
  useResourcesLanguageValue: () => ({ STRONG: 'fr' }),
}))

jest.mock('~common/waitForStrongDB', () => ({
  __esModule: true,
  default: () => (Component: React.ComponentType) => Component,
}))

jest.mock('../CanonicalStrongVerseText', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ verse }: { verse: { Texte: string } }) =>
    ReactModule.createElement('CanonicalStrongVerseText', null, verse.Texte)
})

jest.mock('~helpers/bibleCoverage', () => ({
  getChapterVerseCountSafe: jest.fn(async () => 31),
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

jest.mock('~helpers/CarouselContext', () => ({
  CarouselProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
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
  return () => ReactModule.createElement('StrongCard')
})

const makeAvailableVerse = (text: string) => ({
  status: 'available' as const,
  verse: { Texte: text },
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
