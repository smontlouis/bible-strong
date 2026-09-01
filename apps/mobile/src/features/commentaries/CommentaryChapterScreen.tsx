import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import ScrollView from '~common/ui/ScrollView'
import Box, { TouchableBox } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBookAndVersionSelector } from '~features/bible/BookSelectorSheet/BookSelectorSheetProvider'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getBook } from '~helpers/bibleBookCatalog'
import { IS_FORM_SHEET } from '~helpers/constants'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { getDefaultBibleTab, useBibleTabActions } from '~state/tabs'
import { openCommentaryBookSelector } from './commentaryBookSelector'
import CommentaryResourceHeaderActions from './CommentaryResourceHeaderActions'
import CommentaryRoomIntro from './CommentaryRoomIntro'
import {
  getCommentarySectionsForVerse,
  getCoveredCommentaryLocation,
  groupCommentarySectionsForVerse,
} from './commentaryResourceNavigation'
import { parseCommentaryResourceParams } from './commentaryResourceParams'

const formatRange = (start: number, end: number, introductionLabel: string) => {
  if (start === 0 && end === 0) return introductionLabel
  return start === end ? `${start}` : `${start}–${end}`
}

type CommentarySectionCardProps = {
  section: {
    id: string
    rangeStartVerse: number
    rangeEndVerse: number
    preview: string
  }
  introductionLabel: string
  onPress: () => void
}

const CommentarySectionCard = ({
  section,
  introductionLabel,
  onPress,
}: CommentarySectionCardProps) => (
  <TouchableBox
    bg="reverse"
    rounded
    lightShadow
    px={17}
    py={14}
    activeOpacity={0.62}
    onPress={onPress}
    accessibilityRole="button"
  >
    <Box row alignItems="flex-start">
      <Box px={10} py={5} borderRadius={12} bg="lightPrimary">
        <Text color="primary" bold fontSize={12}>
          {formatRange(section.rangeStartVerse, section.rangeEndVerse, introductionLabel)}
        </Text>
      </Box>
      <Box ml={13} flex>
        <Text color="grey" fontSize={14} lineHeight={20} numberOfLines={2}>
          {section.preview}
        </Text>
      </Box>
      <FeatherIcon name="chevron-right" size={20} color="grey" />
    </Box>
  </TouchableBox>
)

const CommentaryChapterScreen = () => {
  const params = useLocalSearchParams<{
    projectionId?: string
    book?: string
    chapter?: string
    focusVerse?: string
  }>()
  const parsed = parseCommentaryResourceParams(params)
  const parsedFocusVerse = Number(params.focusVerse)
  const focusVerse =
    Number.isSafeInteger(parsedFocusVerse) && parsedFocusVerse > 0 ? parsedFocusVerse : undefined
  const resources = useResourceAccess()
  const router = useRouter()
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const { openBookSelector } = useBookAndVersionSelector()
  const [selectorAtom] = React.useState(() => {
    const initial = getDefaultBibleTab()
    const selectedBook = getBook(parsed?.book ?? 1) ?? getBook(1)!
    initial.data.selectedBook = selectedBook
    initial.data.selectedChapter = parsed?.chapter ?? 1
    initial.data.selectedVerse = 1
    initial.data.temp = {
      selectedBook,
      selectedChapter: parsed?.chapter ?? 1,
      selectedVerse: 1,
    }
    return atom(initial)
  })
  const selectorTab = useAtomValue(selectorAtom)
  const selectorActions = useBibleTabActions(selectorAtom)
  const [expandedChapterContextKey, setExpandedChapterContextKey] = React.useState<string>()

  useEffect(() => {
    if (!parsed) return
    const nextBook = selectorTab.data.selectedBook.Numero
    const nextChapter = selectorTab.data.selectedChapter
    if (nextBook === parsed.book && nextChapter === parsed.chapter) return
    router.setParams({
      book: String(nextBook),
      chapter: String(nextChapter),
      focusVerse: undefined,
    })
  }, [parsed, router, selectorTab.data.selectedBook.Numero, selectorTab.data.selectedChapter])

  const query = useQuery({
    queryKey: [
      'commentary-resource-chapter',
      parsed?.projection.projectionId,
      parsed?.book,
      parsed?.chapter,
    ],
    queryFn: () =>
      resources.commentary.loadResourceChapter({
        resourceId: parsed!.projection.resourceId,
        language: parsed!.projection.language,
        book: parsed!.book,
        chapter: parsed!.chapter,
      }),
    enabled: Boolean(parsed),
    networkMode: 'always',
    retry: false,
  })
  const coverageQuery = useQuery({
    queryKey: resourceQueryKeys.commentaryCoverage(
      parsed?.projection.resourceId ?? '',
      parsed?.projection.language ?? ''
    ),
    queryFn: () =>
      resources.commentary.loadResourceCoverage({
        resourceId: parsed!.projection.resourceId,
        language: parsed!.projection.language,
      }),
    enabled: Boolean(parsed),
    networkMode: 'always',
    retry: false,
  })

  useEffect(() => {
    if (!parsed || !coverageQuery.data) return
    const location = getCoveredCommentaryLocation(coverageQuery.data, parsed)
    if (!location || (location.book === parsed.book && location.chapter === parsed.chapter)) return
    const selectedBook = getBook(location.book)
    if (!selectedBook) return
    selectorActions.setSelectedBook(selectedBook)
    selectorActions.setSelectedChapter(location.chapter)
    selectorActions.setTempSelectedBook(selectedBook)
    selectorActions.setTempSelectedChapter(location.chapter)
  }, [coverageQuery.data, parsed, selectorActions])

  if (!parsed) {
    return (
      <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
        <ResourceUnavailableView
          title={t('commentaries.resource.invalid')}
          failure={{ cause: 'not-found', recoveries: [] }}
        />
      </FormSheetScreen>
    )
  }

  const { entry, projection, book, chapter } = parsed
  const bookLabel = getBook(book)?.Nom ?? String(book)
  const visibleSections = getCommentarySectionsForVerse(query.data?.sections ?? [], focusVerse)
  const chapterContextKey = `${projection.projectionId}:${book}:${chapter}:${focusVerse ?? 'all'}`
  const chapterContextExpanded = expandedChapterContextKey === chapterContextKey
  const groupedSections =
    focusVerse === undefined
      ? { directSections: visibleSections, chapterContextSections: [] }
      : groupCommentarySectionsForVerse({
          sections: visibleSections,
          verse: focusVerse,
          chapterVerseCount: countLsgChapters[`${book}-${chapter}`],
        })

  const openSection = (sectionId: string) =>
    router.push({
      pathname: '/commentary-entry',
      params: {
        projectionId: projection.projectionId,
        book: String(book),
        chapter: String(chapter),
        sectionId,
        focusVerse: focusVerse === undefined ? undefined : String(focusVerse),
      },
    })

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box flex bg="lightGrey">
        <Header
          background
          hasBackButton={IS_FORM_SHEET ? canGoBackInStack : true}
          title={entry.author}
          rightComponent={
            <Box mr={4}>
              <CommentaryResourceHeaderActions
                entry={entry}
                projectionId={projection.projectionId}
                language={projection.language}
                book={book}
                chapter={chapter}
                showAvatar={false}
              />
            </Box>
          }
        />
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
          <CommentaryRoomIntro entry={entry} language={projection.language} />

          <Box row alignItems="center" justifyContent="space-between">
            <Box row alignItems="center" gap={7}>
              <TouchableBox
                bg="lightGrey"
                borderRadius={20}
                height={32}
                px={12}
                row
                alignItems="center"
                disabled={focusVerse !== undefined}
                onPress={
                  focusVerse === undefined
                    ? () => {
                        openCommentaryBookSelector({
                          openBookSelector,
                          actions: selectorActions,
                          data: selectorTab.data,
                          coverage: coverageQuery.data,
                        })
                      }
                    : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={t('commentaries.resource.chooseChapter')}
              >
                <Text bold fontSize={14}>
                  {bookLabel} {chapter}
                  {focusVerse === undefined ? '' : `:${focusVerse}`}
                </Text>
                {focusVerse === undefined ? (
                  <FeatherIcon
                    name="chevron-down"
                    size={14}
                    color="grey"
                    style={{ marginLeft: 6 }}
                  />
                ) : null}
              </TouchableBox>
              {focusVerse !== undefined ? (
                <TouchableBox
                  size={28}
                  borderRadius={16}
                  bg="lightGrey"
                  center
                  activeOpacity={0.62}
                  onPress={() => router.setParams({ focusVerse: undefined })}
                  accessibilityRole="button"
                  accessibilityLabel={t('commentaries.resource.exitVerseFilter')}
                >
                  <FeatherIcon name="x" size={14} />
                </TouchableBox>
              ) : null}
            </Box>
            {query.data ? (
              <Text color="grey" fontSize={13}>
                {t('commentaries.resource.sectionCount', {
                  count: visibleSections.length,
                })}
              </Text>
            ) : null}
          </Box>

          {query.isPending ? (
            <Box minHeight={180} center>
              <Loading />
            </Box>
          ) : query.isError ? (
            <ResourceUnavailableView
              title={t('commentaries.resource.unavailable')}
              failure={resourceFailureFromAccessError(query.error)}
              onRetry={() => void query.refetch()}
            />
          ) : visibleSections.length === 0 ? (
            <Empty
              icon={require('~assets/images/empty-state-icons/comment.svg')}
              message={t('commentaries.resource.emptyChapter')}
            />
          ) : (
            <Box mt={16} gap={12}>
              {groupedSections.directSections.map(section => (
                <CommentarySectionCard
                  key={section.id}
                  section={section}
                  introductionLabel={t('commentaries.resource.introduction')}
                  onPress={() => openSection(section.id)}
                />
              ))}

              {focusVerse !== undefined && groupedSections.chapterContextSections.length > 0 ? (
                <>
                  <TouchableBox
                    bg="reverse"
                    rounded
                    lightShadow
                    px={17}
                    py={14}
                    activeOpacity={0.62}
                    onPress={() =>
                      setExpandedChapterContextKey(currentKey =>
                        currentKey === chapterContextKey ? undefined : chapterContextKey
                      )
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: chapterContextExpanded }}
                  >
                    <Box row alignItems="center" justifyContent="space-between">
                      <Box flex>
                        <Text bold fontSize={14}>
                          {t('commentaries.resource.chapterContext')}
                        </Text>
                        <Text mt={3} color="grey" fontSize={12}>
                          {t('commentaries.resource.sectionCount', {
                            count: groupedSections.chapterContextSections.length,
                          })}
                        </Text>
                      </Box>
                      <FeatherIcon
                        name={chapterContextExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="grey"
                      />
                    </Box>
                  </TouchableBox>

                  {chapterContextExpanded
                    ? groupedSections.chapterContextSections.map(section => (
                        <CommentarySectionCard
                          key={section.id}
                          section={section}
                          introductionLabel={t('commentaries.resource.introduction')}
                          onPress={() => openSection(section.id)}
                        />
                      ))
                    : null}
                </>
              ) : null}
            </Box>
          )}
        </ScrollView>
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryChapterScreen
