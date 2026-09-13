/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResourceAccessError } from '~features/resources/resourceAccessError'

const mockLoadSection = jest.fn()
const mockDismiss = jest.fn()
jest.mock('react-native', () => ({ Linking: { openURL: jest.fn() } }))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ commentaryReading: { loadSection: mockLoadSection } }),
}))
jest.mock('~common/ContextualPanel/ContextualSheet', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef((props: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: mockDismiss }))
      return React.createElement('Sheet', props)
    }),
  }
})
jest.mock('~common/sheet', () => ({
  SheetHeader: 'SheetHeader',
  SheetScrollView: 'SheetScrollView',
  SheetFlatList: 'SheetFlatList',
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('../CommentarySectionCard', () => 'CommentaryCard')
jest.mock('~features/resources/ResourceUnavailableView', () => 'Unavailable')
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('../commentaryResourceParams', () => ({ commentaryHrefToOsis: jest.fn() }))
jest.mock('../commentaryReferenceNavigation', () => ({ getCommentaryBibleViewRoute: jest.fn() }))

import InlineCommentaryReader from '../InlineCommentaryReader'

const request = {
  resourceId: 'MHY',
  language: 'fr' as const,
  revision: 'r1',
  book: 1,
  chapter: 1,
  sectionId: 'section',
  excerpt: 'Preview',
}
let renderer: ReactTestRenderer | undefined
let client: QueryClient
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
})
afterEach(() => {
  act(() => renderer?.unmount())
  renderer = undefined
  client.clear()
})
const flush = () => new Promise(resolve => setTimeout(resolve, 10))

it('opens the requested section directly and navigates without preloading other bodies', async () => {
  mockLoadSection.mockResolvedValue({ section: { content: '<p>Selected section</p>' } })
  const grouped = {
    ...request,
    sectionId: 'first',
    sections: [
      { sectionId: 'first', rangeStartVerse: 1, rangeEndVerse: 2, excerpt: 'First excerpt' },
      { sectionId: 'second', rangeStartVerse: 3, rangeEndVerse: 3, excerpt: 'Second excerpt' },
    ],
  }
  const select = jest.fn()
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <InlineCommentaryReader
          embedded
          request={grouped}
          onClose={jest.fn()}
          onSelectSection={select}
        />
      </QueryClientProvider>
    )
  })
  await act(async () => {
    await flush()
  })
  expect(mockLoadSection).toHaveBeenCalledTimes(1)
  expect(mockLoadSection).toHaveBeenLastCalledWith(
    expect.objectContaining({ sectionId: 'first', revision: 'r1' })
  )
  expect(renderer!.root.findAll(node => String(node.type) === 'Sheet')).toHaveLength(0)
  const card = renderer!.root.find(node => String(node.type) === 'CommentaryCard')
  expect(card.props.book).toBe(1)
  expect(card.props.chapter).toBe(1)
  await act(async () => {
    card.props.onNext()
  })
  await act(async () => {
    await flush()
  })
  expect(mockLoadSection).toHaveBeenCalledTimes(2)
  expect(mockLoadSection).toHaveBeenLastCalledWith(
    expect.objectContaining({ sectionId: 'second', revision: 'r1' })
  )
  expect(select).toHaveBeenCalledWith('second')
})

it('does not load full content until opened, then reads the exact requested revision', async () => {
  mockLoadSection.mockResolvedValue({ section: { content: '<p>Complete</p>' } })
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <InlineCommentaryReader onClose={jest.fn()} />
      </QueryClientProvider>
    )
  })
  expect(mockLoadSection).not.toHaveBeenCalled()
  await act(async () => {
    renderer!.update(
      <QueryClientProvider client={client}>
        <InlineCommentaryReader request={request} onClose={jest.fn()} />
      </QueryClientProvider>
    )
  })
  await act(async () => {
    await flush()
  })
  expect(mockLoadSection).toHaveBeenCalledTimes(1)
  expect(mockLoadSection).toHaveBeenCalledWith(request)
  const html = renderer!.root.find(node => String(node.type) === 'CommentaryCard')
  expect(html.props.section.content).toBe('<p>Complete</p>')
  const header = renderer!.root.find(node => String(node.type) === 'Sheet').props.header
  expect(header.props.title).toBe('Henry')
})

it('keeps the excerpt and refreshes chapter indexes when the requested edition is unavailable', async () => {
  mockLoadSection.mockRejectedValue(new ResourceAccessError('NOT_FOUND'))
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <InlineCommentaryReader request={request} onClose={jest.fn()} />
      </QueryClientProvider>
    )
  })
  await act(async () => {
    await flush()
  })
  expect(
    renderer!.root.findAll(
      node => String(node.type) === 'Text' && node.props.children === 'Preview'
    )
  ).toHaveLength(1)
  const refresh = renderer!.root.find(
    node => String(node.type) === 'Text' && node.props.children === 'inlineCommentary.refresh'
  )
  await act(async () => {
    refresh.props.onPress()
  })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['inline-commentary-index', 1, 1] })
  expect(mockDismiss).toHaveBeenCalledTimes(1)
  expect(mockLoadSection).toHaveBeenCalledTimes(1)
})
