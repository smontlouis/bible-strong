import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import books from '~assets/bible_versions/books-desc'
import { BookSelectorList } from '../BookSelectorList'

let mockSelectionMode: 'grid' | 'list' = 'list'

jest.mock('jotai/react', () => ({
  useAtomValue: () => mockSelectionMode,
}))

jest.mock('../atom', () => ({
  bookSelectorSelectionModeAtom: Symbol('bookSelectorSelectionModeAtom'),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}))

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    FlatList: React.forwardRef(
      (
        { children, ...props }: React.PropsWithChildren<Record<string, unknown>>,
        _ref: React.ForwardedRef<unknown>
      ) => React.createElement('FlatList', props, children)
    ),
    ScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('ScrollView', props, children),
  }
})

jest.mock('../BookItem', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('BookItem', props),
  itemHeight: 46,
}))

jest.mock('../BookShortItem', () => ({
  BookShortItem: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('BookShortItem', props),
}))

jest.mock('../ChapterGrid', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('ChapterGrid', props),
}))

const genesis = books.find(book => book.Numero === 1)!
const psalms = books.find(book => book.Numero === 19)!
const expandedBook = { get: jest.fn(), set: jest.fn() }
const flatListRef = { current: null }
const onBookSelect = jest.fn()
const onGridBookSelect = jest.fn()

const createRenderer = (element: React.ReactElement) => {
  let renderer: ReactTestRenderer
  const consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
      return
    }
    console.warn(message, ...args)
  })

  try {
    act(() => {
      renderer = create(element)
    })
  } finally {
    consoleError.mockRestore()
  }

  return renderer!
}

const renderList = (gridBook: (typeof books)[number] | null = null) => {
  return createRenderer(
    <BookSelectorList
      data={[]}
      initialScrollIndex={0}
      expandedBook={expandedBook as never}
      bookSelectorData={undefined}
      flatListRef={flatListRef}
      chaptersByBook={{ 1: [1, 3, 5], 19: [1, 2, 150] }}
      renderedChapterBookNumbers={[1]}
      onBookSelect={onBookSelect}
      gridBook={gridBook}
      onGridBookSelect={onGridBookSelect}
    />
  )
}

describe('BookSelectorList', () => {
  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    mockSelectionMode = 'list'
    onBookSelect.mockClear()
    onGridBookSelect.mockClear()
  })

  it('keeps list mode on the existing FlatList and BookItem path', () => {
    const renderer = renderList(genesis)
    const list = renderer.root.findByType('FlatList' as never)
    const item = list.props.renderItem({ item: genesis })

    expect(renderer.root.findAllByType('ChapterGrid' as never)).toHaveLength(0)
    expect(item.props).toEqual(
      expect.objectContaining({
        book: genesis,
        chapters: [1, 3, 5],
        expandedBook,
        onBookSelect,
        shouldRenderChapters: true,
      })
    )
    expect(list.props.keyExtractor(genesis)).toBe('1')
  })

  it('uses grid book presses to enter the chapter grid', () => {
    mockSelectionMode = 'grid'
    const renderer = createRenderer(
      <BookSelectorList
        data={[genesis, psalms]}
        initialScrollIndex={0}
        expandedBook={expandedBook as never}
        bookSelectorData={undefined}
        flatListRef={flatListRef}
        chaptersByBook={{ 1: [1, 3, 5], 19: [1, 2, 150] }}
        renderedChapterBookNumbers={[]}
        onBookSelect={onBookSelect}
        gridBook={null}
        onGridBookSelect={onGridBookSelect}
      />
    )

    const genesisItem = renderer.root.findAllByType('BookShortItem' as never)[0]
    act(() => {
      genesisItem.props.onChange(genesis)
    })

    expect(onGridBookSelect).toHaveBeenCalledWith(genesis)
  })

  it('passes partial coverage to the selected grid book', () => {
    mockSelectionMode = 'grid'
    const renderer = renderList(psalms)
    const chapterGrid = renderer.root.findByType('ChapterGrid' as never)

    expect(chapterGrid.props).toEqual(
      expect.objectContaining({ book: psalms, chapters: [1, 2, 150] })
    )
  })
})
