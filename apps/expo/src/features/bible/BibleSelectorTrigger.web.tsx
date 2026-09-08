import { BookSelectorParams } from './BookSelectorSheet/BookSelectorParams'
import FiltersHeader from '~common/FiltersHeader'
import { useRef, useState } from 'react'
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
import { useResourceAccess } from '~features/resources/resourceAccess'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { bookSelectorVersesAtom, bookSelectorSortAtom } from './BookSelectorSheet/atom'
import { useVersionCatalog, VersionCatalogList } from './VersionCatalogView'
import VersionSelectorItem from './VersionSelectorItem'
import BibleOfflineDetailsSheet from './VersionSelectorSheet/BibleOfflineDetailsSheet'
import type { BibleSelectorTriggerProps } from './BibleSelectorTrigger'
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
function BookPanel({
  children,
  className,
  accessibilityLabel,
  data,
  actions,
  coverage,
}: BibleSelectorTriggerProps) {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const openTab = useOpenInNewTab()
  const verseMode = useAtomValue(bookSelectorVersesAtom)
  const withVerses = verseMode === 'with-verses'
  const sort = useAtomValue(bookSelectorSortAtom)
  const [query, setQuery] = useState('')
  const [book, setBook] = useState(data.selectedBook)
  const [chapter, setChapter] = useState(data.selectedChapter)
  const coverageQuery = useQuery({
    queryKey: ['selector-panel-coverage', data.selectedVersion],
    queryFn: () => resources.bibleContent.loadCoverage(data.selectedVersion),
    enabled: !coverage,
  })
  const actualCoverage = coverage ?? coverageQuery.data
  const canon = actualCoverage?.canon?.id
  const books = getBooksForCanon(
    canon && isBibleCanonId(canon) ? canon : getBibleVersionCanonId(data.selectedVersion),
    actualCoverage?.books
  )
  const chapters =
    actualCoverage?.chaptersByBook[book.Numero] ??
    Array.from({ length: book.Chapitres }, (_, i) => i + 1)
  const select = (chapterNumber: number, verse: number) => {
    actions.setTempSelectedBook(book)
    actions.setTempSelectedChapter(chapterNumber)
    actions.setTempSelectedVerse(verse)
    actions.validateTempSelected()
  }
  const longSelect = (chapterNumber: number, verse: number) =>
    openTab(
      {
        id: 'bible-' + generateUUID(),
        title: t('Bible'),
        type: 'bible',
        isRemovable: true,
        data: { ...data, selectedBook: book, selectedChapter: chapterNumber, selectedVerse: verse },
      },
      { autoRedirect: true }
    )
  return (
    <ContextualPanel
      width={400}
      initialScreen="books"
      accessibilityLabel={accessibilityLabel || t('Livres')}
      onClose={() => setQuery('')}
      trigger={<Box className={className}>{children}</Box>}
      screens={{
        books: {
          title: t('Livres'),
          headerRight: <BookSelectorParams includeLayout={false} />,
          headerContent: <PanelSearch value={query} onChange={setQuery} />,
          content: nav => (
            <>
              {[...books]
                .sort((a, b) => (sort === 'alphabetical' ? a.Nom.localeCompare(b.Nom) : 0))
                .filter(item => item.Nom.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
                .map(item => (
                  <PanelAction
                    key={item.Numero}
                    label={item.Nom}
                    nested
                    onPress={() => {
                      setBook(item)
                      nav.open('chapters')
                    }}
                  />
                ))}
            </>
          ),
        },
        chapters: {
          title: book.Nom,
          content: nav => (
            <Box
              testID="bible-selector-number-grid"
              className="flex-row flex-wrap gap-[10px] p-[10px]"
            >
              {chapters.map(value => (
                <TouchableBox
                  key={value}
                  className="w-[48px] h-[48px] rounded-md bg-opacity5 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel={t('Chapitre') + ' ' + value}
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
                  <Text>{value}</Text>
                </TouchableBox>
              ))}
            </Box>
          ),
        },
        verses: {
          title: book.Nom + ' ' + chapter,
          content: nav => (
            <Box
              testID="bible-selector-number-grid"
              className="flex-row flex-wrap gap-[10px] p-[10px]"
            >
              {Array.from(
                {
                  length:
                    getChapterVerseCountFromCoverage(actualCoverage, book.Numero, chapter) ?? 0,
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
      }}
    />
  )
}
export default function BibleSelectorTrigger(props: BibleSelectorTriggerProps) {
  return props.kind === 'version' ? <VersionPanel {...props} /> : <BookPanel {...props} />
}
