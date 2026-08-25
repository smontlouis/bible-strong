import React from 'react'
import books from '~assets/bible_versions/books-desc'
import { BOOK_SELECTION_EVENT } from '../constants'
import ChapterGrid from '../ChapterGrid'

const mockEmit = jest.fn()

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    emit: (...args: unknown[]) => mockEmit(...args),
  },
  useWindowDimensions: () => ({ height: 844, width: 390 }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~common/sheet', () => ({
  SheetScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest
      .requireActual<typeof import('react')>('react')
      .createElement('SheetScrollView', props, children),
}))

jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest.requireActual<typeof import('react')>('react').createElement('Box', props, children),
  TouchableBox: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest
      .requireActual<typeof import('react')>('react')
      .createElement('TouchableBox', props, children),
}))

jest.mock('~common/ui/Text', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest.requireActual<typeof import('react')>('react').createElement('Text', props, children),
}))

const genesis = books.find(book => book.Numero === 1)!
const psalms = books.find(book => book.Numero === 19)!

type ChapterButtonProps = {
  accessibilityLabel: string
  accessibilityRole: string
  onLongPress: () => void
  onPress: () => void
  testID: string
}

const renderGrid = (book: (typeof books)[number], chapters?: number[]) => {
  const grid = ChapterGrid({ book, chapters, selectedChapter: 1 })
  const chapterButtons = React.Children.toArray(
    grid.props.children
  ) as React.ReactElement<ChapterButtonProps>[]

  return { chapterButtons, grid }
}

describe('ChapterGrid', () => {
  beforeEach(() => {
    mockEmit.mockClear()
  })

  it.each([
    ['Genesis', genesis, 50],
    ['Psalms', psalms, 150],
  ])('renders every canonical chapter for %s and selects the final one', (_, book, lastChapter) => {
    const { chapterButtons, grid } = renderGrid(book)

    expect(grid.props.testID).toBe(`book-selector-chapter-grid-${book.Numero}`)
    expect(grid.props.contentContainerStyle).toEqual(
      expect.objectContaining({ flexDirection: 'row', flexWrap: 'wrap' })
    )
    expect(grid.props.showsVerticalScrollIndicator).toBe(true)
    expect(chapterButtons).toHaveLength(lastChapter)

    const finalChapter = chapterButtons.find(
      chapter => chapter.props.testID === `book-selector-chapter-${book.Numero}-${lastChapter}`
    )!

    expect(finalChapter.props.accessibilityLabel).toBe(`Chapitre ${lastChapter}`)
    expect(finalChapter.props.accessibilityRole).toBe('button')
    finalChapter.props.onPress()

    expect(mockEmit).toHaveBeenCalledWith(BOOK_SELECTION_EVENT, {
      type: 'select',
      book,
      chapter: lastChapter,
    })
  })

  it('preserves the existing long-press selection event', () => {
    const { chapterButtons } = renderGrid(genesis)
    const finalChapter = chapterButtons.at(-1)!

    finalChapter.props.onLongPress()

    expect(mockEmit).toHaveBeenCalledWith(BOOK_SELECTION_EVENT, {
      type: 'longPress',
      book: genesis,
      chapter: 50,
    })
  })

  it('uses partial-version coverage exactly as supplied', () => {
    const { chapterButtons } = renderGrid(psalms, [1, 3, 7, 12])

    expect(chapterButtons.map(chapter => chapter.props.testID)).toEqual([
      'book-selector-chapter-19-1',
      'book-selector-chapter-19-3',
      'book-selector-chapter-19-7',
      'book-selector-chapter-19-12',
    ])
  })

  it('does not replace explicitly empty coverage with canonical chapters', () => {
    const { chapterButtons } = renderGrid(psalms, [])

    expect(chapterButtons).toHaveLength(0)
  })
})
