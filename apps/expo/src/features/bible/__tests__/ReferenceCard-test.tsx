import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReferenceCard } from '../ReferenceCard'

const mockLoadVerseTexts = jest.fn()
const mockLoadReferences = jest.fn()
const mockResources = {
  bibleReading: {
    getTresorAvailability: async () => ({ status: 'available' }),
    loadTresorReferences: mockLoadReferences,
  },
  bibleContent: { loadVerseTexts: mockLoadVerseTexts },
}
jest.mock('~features/resources/resourceAccess', () => ({ useResourceAccess: () => mockResources }))
jest.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ colors: {}, fontFamily: { title: 'test' } }),
}))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: () => 'test' }))
jest.mock('~helpers/useLanguage', () => ({ __esModule: true, default: () => 'en' }))
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: (keys: string[]) => keys.join(','),
}))
jest.mock('~helpers/agentObservability', () => ({ appLogger: { captureError: jest.fn() } }))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Paragraph', () => 'Paragraph')
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/Empty', () => 'Empty')
jest.mock('~common/Link', () => 'Link')
jest.mock('~features/resources/ResourceUnavailableView', () => 'ResourceUnavailableView')
let tree: ReactTestRenderer
let client: QueryClient
const flush = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })
}
beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  mockLoadReferences.mockReset().mockResolvedValue(['45-6-16'])
  mockLoadVerseTexts.mockReset()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  act(() => tree?.unmount())
  client.clear()
})
const render = async () => {
  act(() => {
    tree = create(
      <QueryClientProvider client={client}>
        <ReferenceCard selectedVerse="45-6-16" version="KJV" />
      </QueryClientProvider>
    )
  })
  await flush()
  await flush()
}
it('keeps the reference label visible while verse text is loading', async () => {
  mockLoadVerseTexts.mockReturnValue(new Promise(() => {}))
  await render()
  expect(
    tree.root.findAll(node => String(node.type) === 'Text' && node.props.children === '45-6-16')
  ).toHaveLength(1)
  expect(tree.root.findAll(node => String(node.type) === 'ActivityIndicator')).toHaveLength(1)
})
it.each([new Error('offline'), {}])(
  'shows failed or missing verse text and allows retry (%s)',
  async failure => {
    mockLoadVerseTexts
      .mockImplementationOnce(() =>
        failure instanceof Error ? Promise.reject(failure) : Promise.resolve(failure)
      )
      .mockResolvedValue({ '45-6-16': 'Recovered text' })
    await render()
    expect(
      tree.root.findAll(
        node => String(node.type) === 'Text' && node.props.accessibilityRole === 'alert'
      )
    ).toHaveLength(1)
    const button = tree.root.find(node => String(node.type) === 'TouchableBox')
    act(() => button.props.onPress())
    await flush()
    expect(
      tree.root.findAll(
        node => String(node.type) === 'Paragraph' && node.props.children.includes('Recovered text')
      )
    ).toHaveLength(1)
    expect(mockLoadVerseTexts).toHaveBeenCalledTimes(2)
  }
)
it('localizes empty reference lists', async () => {
  mockLoadReferences.mockResolvedValue([])
  await render()
  expect(tree.root.find(node => String(node.type) === 'Empty').props.message).toBe(
    'resource.crossReferences.noneForVerse'
  )
})
