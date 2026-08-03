import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import StrongEntityRouteScreen from '../StrongEntityRouteScreen'

const mockEntryState = { entry: { stepCode: 'H0175' } }

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[1] === 'availability'
      ? { data: { status: 'available', moduleId: 'entities' }, isPending: false }
      : { data: { name: 'Aaron' }, isPending: false },
}))

jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ strongLexicon: {} }),
}))

jest.mock('../useStrongEntryRoute', () => ({
  useStrongEntryRoute: () => mockEntryState,
}))

jest.mock('../useStrongLexiconLanguage', () => ({
  useStrongLexiconLanguage: () => ({ language: 'fr' }),
}))

jest.mock('../useStrongReadingTypography', () => ({
  useStrongReadingTypography: () => ({}),
}))

jest.mock('../useStrongRouteNavigation', () => ({
  useStrongRouteNavigation: () => ({
    openBibleReference: jest.fn(),
    openStrong: jest.fn(),
    openEntity: jest.fn(),
    openEntityRelation: jest.fn(),
  }),
}))

jest.mock('../StrongEntryRouteScaffold', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('StrongEntryRouteScaffold', props, children)
})

jest.mock('../StrongEntityPage', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('StrongEntityPage', props)
})

describe('StrongEntityRouteScreen', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('uses the shared Strong header scaffold for entity routes', () => {
    act(() => {
      renderer = create(<StrongEntityRouteScreen context={{}} entityKey="person:aaron" />)
    })

    const scaffold = renderer.root.find(node => String(node.type) === 'StrongEntryRouteScaffold')
    expect(scaffold.props.entryState).toBe(mockEntryState)
    expect(scaffold.props.requireEntry).toBe(false)
    expect(scaffold.props.title).toBe('Aaron')
    expect(renderer.root.find(node => String(node.type) === 'StrongEntityPage')).toBeDefined()
  })
})
