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
jest.mock('~common/SwitchableHTMLView', () => 'HTMLView')
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

it('shows excerpts for a group and loads only the section explicitly selected', async () => {
  mockLoadSection.mockResolvedValue({ section: { content: '<p>Selected section</p>' } })
  const grouped = {
    ...request,
    sections: [
      { sectionId: 'first', rangeStartVerse: 1, rangeEndVerse: 2, excerpt: 'First excerpt' },
      { sectionId: 'second', rangeStartVerse: 2, rangeEndVerse: 2, excerpt: 'Second excerpt' },
    ],
  }
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={client}>
        <InlineCommentaryReader request={grouped} onClose={jest.fn()} />
      </QueryClientProvider>
    )
  })
  expect(mockLoadSection).not.toHaveBeenCalled()
  const list = renderer!.root.find(node => String(node.type) === 'SheetFlatList')
  const item = list.props.renderItem({ item: grouped.sections[1], index: 1 })
  await act(async () => {
    item.props.onPress()
  })
  await act(async () => {
    await flush()
  })
  expect(mockLoadSection).toHaveBeenCalledTimes(1)
  expect(mockLoadSection).toHaveBeenCalledWith(
    expect.objectContaining({ sectionId: 'second', revision: 'r1' })
  )
  const header = renderer!.root.find(node => String(node.type) === 'Sheet').props.header
  await act(async () => {
    header.props.onBackPress()
  })
  expect(renderer!.root.findAll(node => String(node.type) === 'SheetFlatList')).toHaveLength(1)
  expect(mockLoadSection).toHaveBeenCalledTimes(1)
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
  const html = renderer!.root.find(node => String(node.type) === 'HTMLView')
  expect(html.props.value).toBe('<p>Complete</p>')
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
