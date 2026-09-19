import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { SheetRef } from '~common/sheet'
import StrongSelectionSheet from '../StrongSelectionSheet'

const mockDismiss = jest.fn()
const mockPushRouteOnce = jest.fn()

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}))

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[1] === 'availability'
      ? {
          data: { status: 'available' },
          error: undefined,
          isError: false,
          isPending: false,
          isSuccess: true,
          refetch: jest.fn(),
        }
      : {
          data: {
            morphologies: [],
            previews: [
              {
                definitionHtml: '<p>Definition</p>',
                gloss: 'Dieu',
                language: 'hebrew',
                original: 'אֱלֹהִים',
                selectedIdentity: { kind: 'strong', code: 'H0430' },
                stepCode: 'H0430',
                transliteration: 'Elohim',
              },
            ],
          },
          error: undefined,
          isError: false,
          isPending: false,
          isSuccess: true,
          refetch: jest.fn(),
        },
}))

jest.mock('jotai/react', () => ({ useAtomValue: () => 'fr' }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('trunc-html', () => ({ __esModule: true, default: (html: string) => ({ html }) }))

jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      default: '#111',
      lightGrey: '#eee',
      primary: '#00f',
      reverse: '#fff',
      tertiary: '#777',
    },
  }),
}))
jest.mock('~themes/colorValues', () => ({
  colorWithOpacity: (color: string) => color,
  resolveThemeColor: (theme: { colors: Record<string, string> }, name: string) =>
    theme.colors[name],
}))

jest.mock('~common/HorizontalControlScrollView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ReactModule.forwardRef(
    (
      { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.ForwardedRef<{ scrollTo: jest.Mock }>
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({ scrollTo: jest.fn() }))
      return ReactModule.createElement('HorizontalControlScrollView', props, children)
    }
  )
})

jest.mock('../StrongSelectionContainer', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (
        { children }: React.PropsWithChildren<Record<string, unknown>>,
        _ref: React.ForwardedRef<unknown>
      ) => ReactModule.createElement('StrongSelectionContainer', null, children)
    ),
  }
})

jest.mock('~common/sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    SheetHeader: ({ title }: { title?: string }) =>
      ReactModule.createElement('SheetHeader', { title }),
    SheetView: ({ children }: React.PropsWithChildren) =>
      ReactModule.createElement('SheetView', null, children),
  }
})
jest.mock('~common/StylizedHTMLView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('StylizedHTMLView', props)
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const makeHost =
    (name: string) =>
    ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement(name, props, children)

  return {
    __esModule: true,
    default: makeHost('Box'),
    FadingBox: makeHost('FadingBox'),
    HStack: makeHost('HStack'),
    VStack: makeHost('VStack'),
  }
})
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'FeatherIcon' }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ strongLexicon: {} }),
}))
jest.mock('~features/resources/ResourceUnavailableView', () => 'ResourceUnavailableView')
jest.mock('~features/resources/resourceFailure', () => ({
  resourceFailureFromAccessError: jest.fn(),
  resourceFailureFromStrongModuleAvailability: jest.fn(),
}))
jest.mock('~helpers/useDownloadQueue', () => ({ useDownloadItemStatus: () => undefined }))
jest.mock('~helpers/offlineCopyId', () => ({ createOfflineCopyId: jest.fn() }))
jest.mock('~helpers/strongIdentities', () => ({
  createStrongIdentity: (code: string) => ({ kind: 'strong', code }),
}))
jest.mock('~helpers/strongSelection', () => ({
  getStrongSelectionMorphologyCodes: () => [],
}))
jest.mock('~navigation/usePushRouteOnce', () => ({
  usePushRouteOnce: () => mockPushRouteOnce,
}))
jest.mock('~state/resourcesLanguage', () => ({ resourcesLanguageAtom: {} }))
jest.mock('../strongSelectionPreviewCard', () => ({
  createStrongSelectionPreviewCard: (preview: Record<string, unknown>) => preview,
}))
jest.mock('../strongSelectionPreviewCarousel', () => ({
  getStrongSelectionPreviewIndex: () => 0,
  prioritizeStrongSelectionPreview: (previews: unknown[]) => previews,
}))
jest.mock('../strongSelectionPreviewHtmlStyles', () => ({
  getStrongSelectionPreviewHtmlStyles: () => ({}),
}))
jest.mock('../StrongPreviewFade', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children }: React.PropsWithChildren) =>
    ReactModule.createElement('StrongPreviewFade', null, children)
})

describe('StrongSelectionSheet', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    mockDismiss.mockClear()
    mockPushRouteOnce.mockClear()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
  })

  it('opens the Strong form sheet without dismissing the preview bottom sheet', () => {
    const sheetRef = {
      current: { dismiss: mockDismiss },
    } as unknown as React.RefObject<SheetRef | null>

    act(() => {
      renderer = create(
        <StrongSelectionSheet
          sheetRef={sheetRef}
          version="LSG"
          book={1}
          chapter={1}
          verse={1}
          word="Dieu"
          identities={[{ kind: 'strong', code: 'H0430' }]}
          morphologies={[]}
          onDismissStart={jest.fn()}
          onClose={jest.fn()}
        />
      )
    })

    const touchables = renderer!.root.findAll(node => String(node.type) === 'TouchableOpacity')
    const previewCard = touchables[touchables.length - 1]

    act(() => previewCard.props.onPress())

    expect(mockDismiss).not.toHaveBeenCalled()
    expect(mockPushRouteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/strong',
        params: expect.objectContaining({
          bibleChapter: '1',
          bibleVerse: '1',
          identityCode: 'H0430',
        }),
      })
    )
  })
})
