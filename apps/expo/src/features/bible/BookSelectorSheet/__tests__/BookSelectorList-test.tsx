import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import books from '~assets/bible_versions/books-desc'
import { BookSelectorList } from '../BookSelectorList'
import { getTestamentGroups } from '../bookListRows'

let mockSelectionMode: 'grid' | 'list' = 'list'

jest.mock('jotai/react', () => ({
  useAtomValue: () => mockSelectionMode,
}))

jest.mock('../atom', () => ({
  bookSelectorSelectionModeAtom: Symbol('bookSelectorSelectionModeAtom'),
}))

jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest.requireActual<typeof import('react')>('react').createElement('Box', props, children),
}))

jest.mock('../TestamentTitle', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('TestamentTitle', props),
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

jest.mock('~helpers/readingLanguage', () => ({
  getReadingBookName: (book: { Nom: string }) => book.Nom,
}))
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
const matthew = books.find(book => book.Numero === 40)!
const expandedBook = { get: jest.fn(), set: jest.fn() }
const flatListRef = { current: null }
const listMetrics = { current: { scrollOffset: 0, viewportHeight: 0 } }
const onBookSelect = jest.fn()
const onGridBookSelect = jest.fn()
const canonical = (...listed: (typeof books)[number][]) => getTestamentGroups(listed, false)
const bookRow = (book: (typeof books)[number]) => ({ type: 'book' as const, book })

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
      groups={[]}
      initialScrollOffset={0}
      expandedBook={expandedBook as never}
      bookSelectorData={undefined}
      flatListRef={flatListRef}
      listMetrics={listMetrics}
      chaptersByBook={{ 1: [1, 3, 5], 19: [1, 2, 150] }}
      renderedChapterBookNumbers={[1]}
      instantBookNumber={null}
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
    const item = list.props.renderItem({ item: bookRow(genesis) })

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
    expect(list.props.keyExtractor(bookRow(genesis))).toBe('1')
  })

  it('sets each testament title before its books and keeps it over them', () => {
    const renderer = createRenderer(
      <BookSelectorList
        groups={canonical(genesis, psalms, matthew)}
        initialScrollOffset={0}
        expandedBook={expandedBook as never}
        flatListRef={flatListRef}
        listMetrics={listMetrics}
        renderedChapterBookNumbers={[]}
        instantBookNumber={null}
        onBookSelect={onBookSelect}
        gridBook={null}
        onGridBookSelect={onGridBookSelect}
      />
    )
    const list = renderer.root.findByType('FlatList' as never)

    expect(list.props.data.map(list.props.keyExtractor)).toEqual(['old', '1', '19', 'new', '40'])
    expect(list.props.stickyHeaderIndices).toEqual([0, 3])
    expect(list.props.renderItem({ item: list.props.data[3] }).props).toEqual({
      testament: 'new',
    })
  })

  it('has no title for books sorted by name', () => {
    const renderer = createRenderer(
      <BookSelectorList
        groups={getTestamentGroups([matthew, genesis], true)}
        initialScrollOffset={0}
        expandedBook={expandedBook as never}
        flatListRef={flatListRef}
        listMetrics={listMetrics}
        renderedChapterBookNumbers={[]}
        instantBookNumber={null}
        onBookSelect={onBookSelect}
        gridBook={null}
        onGridBookSelect={onGridBookSelect}
      />
    )
    const list = renderer.root.findByType('FlatList' as never)

    expect(list.props.data.map(list.props.keyExtractor)).toEqual(['40', '1'])
    expect(list.props.stickyHeaderIndices).toEqual([])
  })

  it('passes the current chapter and the instant expansion to the selected book only', () => {
    const renderer = createRenderer(
      <BookSelectorList
        groups={canonical(genesis, psalms)}
        initialScrollOffset={0}
        expandedBook={expandedBook as never}
        bookSelectorData={{ selectedBook: psalms, selectedChapter: 119 } as never}
        flatListRef={flatListRef}
        listMetrics={listMetrics}
        renderedChapterBookNumbers={[19]}
        instantBookNumber={19}
        onBookSelect={onBookSelect}
        gridBook={null}
        onGridBookSelect={onGridBookSelect}
      />
    )
    const list = renderer.root.findByType('FlatList' as never)

    expect(list.props.renderItem({ item: bookRow(psalms) }).props).toEqual(
      expect.objectContaining({ isSelected: true, selectedChapter: 119, expandsInstantly: true })
    )
    expect(list.props.renderItem({ item: bookRow(genesis) }).props).toEqual(
      expect.objectContaining({
        isSelected: false,
        selectedChapter: undefined,
        expandsInstantly: false,
      })
    )
  })

  it('mounts every row at the opening offset', () => {
    const renderer = createRenderer(
      <BookSelectorList
        groups={canonical(genesis, psalms)}
        initialScrollOffset={1200}
        expandedBook={expandedBook as never}
        bookSelectorData={{ selectedBook: psalms, selectedChapter: 119 } as never}
        flatListRef={flatListRef}
        listMetrics={listMetrics}
        renderedChapterBookNumbers={[19]}
        instantBookNumber={19}
        onBookSelect={onBookSelect}
        gridBook={null}
        onGridBookSelect={onGridBookSelect}
      />
    )
    const list = renderer.root.findByType('FlatList' as never)

    expect(list.props.contentOffset).toEqual({ x: 0, y: 1200 })
    // The title of the Old Testament and its two books
    expect(list.props.initialNumToRender).toBe(3)
  })

  it('uses grid book presses to enter the chapter grid', () => {
    mockSelectionMode = 'grid'
    const renderer = createRenderer(
      <BookSelectorList
        groups={canonical(genesis, psalms)}
        initialScrollOffset={0}
        expandedBook={expandedBook as never}
        bookSelectorData={undefined}
        flatListRef={flatListRef}
        listMetrics={listMetrics}
        chaptersByBook={{ 1: [1, 3, 5], 19: [1, 2, 150] }}
        renderedChapterBookNumbers={[]}
        instantBookNumber={null}
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

  it('heads each testament of the grid with its title, in the canon order only', () => {
    mockSelectionMode = 'grid'
    const renderGrid = (isAlphabetical: boolean) =>
      createRenderer(
        <BookSelectorList
          groups={getTestamentGroups([genesis, psalms, matthew], isAlphabetical)}
          initialScrollOffset={0}
          expandedBook={expandedBook as never}
          bookSelectorData={undefined}
          flatListRef={flatListRef}
          listMetrics={listMetrics}
          renderedChapterBookNumbers={[]}
          instantBookNumber={null}
          onBookSelect={onBookSelect}
          gridBook={null}
          onGridBookSelect={onGridBookSelect}
        />
      )

    const inCanonOrder = renderGrid(false)
    const titles = inCanonOrder.root.findAllByType('TestamentTitle' as never)
    expect(titles.map(title => title.props.testament)).toEqual(['old', 'new'])
    const groups = inCanonOrder.root
      .findAll(
        node => node.type === ('Box' as never) && node.props.className?.includes('flex-wrap')
      )
      .map(group =>
        group.findAllByType('BookShortItem' as never).map(item => item.props.book.Numero)
      )
    expect(groups).toEqual([[1, 19], [40]])

    const alphabetical = renderGrid(true)
    expect(alphabetical.root.findAllByType('TestamentTitle' as never)).toHaveLength(0)
    expect(alphabetical.root.findAllByType('BookShortItem' as never)).toHaveLength(3)
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
