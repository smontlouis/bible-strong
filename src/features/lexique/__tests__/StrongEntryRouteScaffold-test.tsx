import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import StrongEntryRouteScaffold from '../StrongEntryRouteScaffold'

const mockOpenEntityRelations = jest.fn()
const tags = { tag1: { id: 'tag1', name: 'À revoir' } }

jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({}),
}))

jest.mock('~redux/selectors/bible', () => ({
  makeStrongTagsSelector: () => () => tags,
}))

jest.mock('~features/studyRelations/useRelationCount', () => ({
  useRelationCount: () => 3,
}))

jest.mock('~features/studyRelations/useOpenEntityRelations', () => ({
  useOpenEntityRelations: () => mockOpenEntityRelations,
}))

jest.mock('~features/studyRelations/endpoints', () => ({
  createStrongEndpoint: ({ language, code }: { language: string; code: string }) => ({
    type: 'strong',
    language,
    code: code.replace(/^[HG]0*/u, ''),
  }),
}))

jest.mock('~navigation/useCanGoBackInStack', () => ({
  useCanGoBackInStack: () => false,
}))

jest.mock('~helpers/useDownloadQueue', () => ({
  useDownloadItemStatus: () => undefined,
}))

jest.mock('~helpers/downloadManager', () => ({
  downloadManager: { enqueue: jest.fn() },
}))
jest.mock('~helpers/downloadItemFactory', () => ({
  createStrongLexiconModuleDownloadItem: jest.fn(),
}))
jest.mock('~helpers/offlineCopyId', () => ({
  createOfflineCopyId: jest.fn(() => 'strong-core'),
}))

jest.mock('~common/Empty', () => () => null)
jest.mock('~common/Loading', () => () => null)
jest.mock('~common/ui/Button', () => () => null)
jest.mock('~common/ui/Text', () => () => null)
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Component = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)
  return { __esModule: true, default: Component, VStack: Component }
})

jest.mock('~common/Header', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Header', props, children)
})

jest.mock('~common/ui/FormSheetScreen', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('FormSheetScreen', props, children)
})

jest.mock('~common/EntityChipList', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('EntityChipList', props)
})

jest.mock('../StrongEntryMenu', () => () => null)

describe('StrongEntryRouteScaffold', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    mockOpenEntityRelations.mockClear()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('shows Strong tags and relations inside the detail header', () => {
    act(() => {
      renderer = create(
        <StrongEntryRouteScaffold
          context={{ book: 1, reference: 'H0310A' }}
          entryState={
            {
              identity: { kind: 'dstrong', code: 'H0310A' },
              coreAvailability: {
                isPending: false,
                data: { status: 'available' },
              },
              entryQuery: { isPending: false, isError: false },
              entry: {
                stepCode: 'H0310A',
                language: 'hebrew',
                gloss: 'après',
                original: 'אַחַר',
              },
            } as never
          }
          title="Étude de mot"
        >
          <></>
        </StrongEntryRouteScaffold>
      )
    })

    const chips = renderer.root.find(node => String(node.type) === 'EntityChipList')
    expect(chips.props.tags).toBe(tags)
    expect(chips.props.relationCount).toBe(3)

    act(() => chips.props.onRelationPress())

    expect(mockOpenEntityRelations).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'strong',
        language: 'hebrew',
        code: '310A',
      })
    )
  })

  it('can render an autonomous entity route without a Strong entry', () => {
    act(() => {
      renderer = create(
        <StrongEntryRouteScaffold
          requireEntry={false}
          context={{}}
          entryState={
            {
              identity: undefined,
              coreAvailability: { isPending: false, data: { status: 'available' } },
              entryQuery: { isPending: false, isError: false },
              entry: undefined,
            } as never
          }
          title="Aaron"
        >
          {React.createElement('EntityContent', { routeContent: 'entity' })}
        </StrongEntryRouteScaffold>
      )
    })

    expect(renderer.root.find(node => node.props.routeContent === 'entity')).toBeDefined()
  })
})
