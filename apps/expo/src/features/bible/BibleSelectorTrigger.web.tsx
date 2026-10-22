import { BookSelectorParams } from './BookSelectorSheet/BookSelectorParams'
import FiltersHeader from '~common/FiltersHeader'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import { useQuery } from '@tanstack/react-query'
import ContextualPanel from '~common/ContextualPanel'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import PanelAction from '~common/ContextualPanel/PanelAction'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { SheetRef } from '~common/sheet'
import { getBooksForCanon, isBibleCanonId } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId, versions } from '~helpers/bibleVersions'
import { getChapterVerseCountFromCoverage } from '~helpers/bibleCoverage'
import { getReadingBookName } from '~helpers/readingLanguage'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { bookSelectorVersesAtom, bookSelectorSortAtom } from './BookSelectorSheet/atom'
import { useVersionCatalog, VersionCatalogList } from './VersionCatalogView'
import VersionSelectorItem from './VersionSelectorItem'
import BibleOfflineDetailsSheet from './VersionSelectorSheet/BibleOfflineDetailsSheet'
import type { BibleSelectorTriggerProps } from './BibleSelectorTrigger'
import type { PanelScreen } from '~common/ContextualPanel/types'
import type { Version } from '~helpers/bibleVersions'

function VersionPanel({
  children,
  className,
  accessibilityLabel,
  data,
  actions,
}: BibleSelectorTriggerProps) {
  const { t } = useTranslation()
  const catalog = useVersionCatalog(Object.values(versions).filter(version => !version.hidden))
  const detailsRef = useRef<SheetRef>(null)
  const [details, setDetails] = useState<Version>()
  return (
    <>
      <ContextualPanel
        width={500}
        initialScreen="versions"
        accessibilityLabel={accessibilityLabel || t('Version')}
        onClose={catalog.resetSearch}
        trigger={<Box className={className}>{children}</Box>}
        screens={{
          versions: {
            title: t('Version'),
            headerRight: (
              <FiltersHeader
                buttonOnly
                title=""
                {...catalog.headerProps}
                filters={catalog.headerProps.filters.filter(filter => filter.key !== 'search')}
              />
            ),
            headerContent: <PanelSearch value={catalog.query} onChange={catalog.setQuery} />,
            content: nav => (
              <VersionCatalogList
                sections={catalog.sections}
                grouping={catalog.grouping}
                query={catalog.query}
                openStyleInfo={catalog.openStyleInfo}
                bottomInset={0}
                revealVersionId={data.selectedVersion}
                revealKey={0}
                scrollToTopKey={catalog.filterKey}
                renderItem={({ item }) => (
                  <VersionSelectorItem
                    version={item}
                    isSelected={item.id === data.selectedVersion}
                    showStrongIndex
                    onChange={version => {
                      actions.setSelectedVersion(version)
                      nav.close()
                    }}
                    onOpenInterlinear={
                      data.parallelVersions?.length
                        ? undefined
                        : version => {
                            actions.setSelectedVersionInInterlinear(version)
                            nav.close()
                          }
                    }
                    onOpenOfflineDetails={version => {
                      setDetails(version)
                      requestAnimationFrame(() => detailsRef.current?.present())
                    }}
                  />
                )}
              />
            ),
          },
        }}
      />
      {catalog.modals}
      <BibleOfflineDetailsSheet sheetRef={detailsRef} version={details} />
    </>
  )
}
/**
 * Scrolls its content to the middle of the panel each time the panel screen holding it is shown:
 * a hidden screen has no size, so the size it takes when shown is the signal.
 */
function RevealWhenShown({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let shown = false
    const observer = new ResizeObserver(() => {
      const isShown = element.offsetHeight > 0
      if (isShown && !shown) element.scrollIntoView({ block: 'center' })
      shown = isShown
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref}>{children}</div>
}

export function useBookPanelScreens({
  data,
  actions,
  coverage,
  forceVerses,
  onLongSelect,
}: Pick<BibleSelectorTriggerProps, 'data' | 'coverage'> & {
  actions?: BibleSelectorTriggerProps['actions']
  forceVerses?: boolean
  onLongSelect?: (
    book: BibleSelectorTriggerProps['data']['selectedBook'],
    chapter: number,
    verse: number
  ) => void
}) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const openTab = useOpenInNewTab()
  const verseMode = useAtomValue(bookSelectorVersesAtom)
  const withVerses = forceVerses ?? verseMode === 'with-verses'
  const sort = useAtomValue(bookSelectorSortAtom)
  const [query, setQuery] = useState('')
  const [book, setBook] = useState(data.selectedBook)
  const [chapter, setChapter] = useState(data.selectedChapter)
  const coverageQuery = useQuery({
    // The same coverage as the other Bible selectors, read once for all of them.
    queryKey: resourceQueryKeys.bibleCoverage(data.selectedVersion),
    queryFn: () => resources.bibleContent.loadCoverage(data.selectedVersion),
    enabled: !coverage,
    ...staticResourceQueryOptions,
  })
  const actualCoverage = coverage ?? coverageQuery.data
  const canon = actualCoverage?.canon?.id
  const books = getBooksForCanon(
    canon && isBibleCanonId(canon) ? canon : getBibleVersionCanonId(data.selectedVersion),
    actualCoverage?.books
  )
  // Book names speak the reading's language
  const nameOf = (item: { Nom: string }) => getReadingBookName(item, data.selectedVersion)
  const chapters =
    actualCoverage?.chaptersByBook[book.Numero] ??
    Array.from({ length: book.Chapitres }, (_, i) => i + 1)
  const select = (chapterNumber: number, verse: number) => {
    if (!actions) return
    actions.setTempSelectedBook(book)
    actions.setTempSelectedChapter(chapterNumber)
    actions.setTempSelectedVerse(verse)
    actions.validateTempSelected()
  }
  const longSelect = (chapterNumber: number, verse: number) => {
    if (onLongSelect) return onLongSelect(book, chapterNumber, verse)
    return openTab(
      {
        id: 'bible-' + generateUUID(),
        title: t('Bible'),
        type: 'bible',
        isRemovable: true,
        data: { ...data, selectedBook: book, selectedChapter: chapterNumber, selectedVerse: verse },
      },
      { autoRedirect: true }
    )
  }
  return {
    reset: () => {
      setQuery('')
      setBook(data.selectedBook)
      setChapter(data.selectedChapter)
    },
    screens: {
      books: {
        title: t('Livres'),
        headerRight: (
          <BookSelectorParams includeLayout={false} includeVerses={forceVerses === undefined} />
        ),
        headerContent: <PanelSearch value={query} onChange={setQuery} />,
        content: nav => (
          <>
            {[...books]
              .sort((a, b) => (sort === 'alphabetical' ? nameOf(a).localeCompare(nameOf(b)) : 0))
              .filter(item =>
                [nameOf(item), item.Nom].some(name =>
                  name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
                )
              )
              .map(item => {
                const action = (
                  <PanelAction
                    key={item.Numero}
                    label={nameOf(item)}
                    nested
                    selected={item.Numero === data.selectedBook.Numero}
                    onPress={() => {
                      setBook(item)
                      nav.open('chapters')
                    }}
                  />
                )
                // The reading's book is where the list opens, back from its chapters
                return item.Numero === data.selectedBook.Numero ? (
                  <RevealWhenShown key={item.Numero}>{action}</RevealWhenShown>
                ) : (
                  action
                )
              })}
          </>
        ),
      },
      chapters: {
        title: nameOf(book),
        content: nav => (
          <Box
            testID="bible-selector-number-grid"
            className="flex-row flex-wrap gap-[10px] p-[10px]"
          >
            {chapters.map(value => {
              const isCurrent =
                book.Numero === data.selectedBook.Numero && value === data.selectedChapter
              return (
                <TouchableBox
                  key={value}
                  className={`w-[48px] h-[48px] rounded-md items-center justify-center ${isCurrent ? 'bg-light-primary' : 'bg-opacity5'}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('Chapitre') + ' ' + value}
                  accessibilityState={{ selected: isCurrent }}
                  onPress={() => {
                    if (withVerses) {
                      setChapter(value)
                      nav.open('verses')
                    } else {
                      select(value, 1)
                      nav.close()
                    }
                  }}
                  onLongPress={() => {
                    longSelect(value, 1)
                    nav.close()
                  }}
                >
                  <Text className={isCurrent ? 'text-primary font-bold' : undefined}>{value}</Text>
                </TouchableBox>
              )
            })}
          </Box>
        ),
      },
      verses: {
        title: nameOf(book) + ' ' + chapter,
        content: nav => (
          <Box
            testID="bible-selector-number-grid"
            className="flex-row flex-wrap gap-[10px] p-[10px]"
          >
            {Array.from(
              {
                length: getChapterVerseCountFromCoverage(actualCoverage, book.Numero, chapter) ?? 0,
              },
              (_, i) => i + 1
            ).map(verse => (
              <TouchableBox
                key={verse}
                className="w-[40px] h-[40px] rounded-md bg-opacity5 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={t('Verset') + ' ' + verse}
                onPress={() => {
                  select(chapter, verse)
                  nav.close()
                }}
                onLongPress={() => {
                  longSelect(chapter, verse)
                  nav.close()
                }}
              >
                <Text>{verse}</Text>
              </TouchableBox>
            ))}
          </Box>
        ),
      },
    } satisfies Record<string, PanelScreen>,
  }
}

function BookPanel({
  children,
  className,
  accessibilityLabel,
  ...props
}: BibleSelectorTriggerProps) {
  const { t } = useTranslation()
  const panel = useBookPanelScreens(props)
  return (
    <ContextualPanel
      width={400}
      initialScreen="books"
      // Opens on the reading's chapters, as the native selector opens on its book
      initialStack={['books', 'chapters']}
      accessibilityLabel={accessibilityLabel || t('Livres')}
      // On opening too: closing after a choice resets to the book read before it
      onOpen={panel.reset}
      onClose={panel.reset}
      trigger={<Box className={className}>{children}</Box>}
      screens={panel.screens}
    />
  )
}

export default function BibleSelectorTrigger(props: BibleSelectorTriggerProps) {
  return props.kind === 'version' ? <VersionPanel {...props} /> : <BookPanel {...props} />
}
