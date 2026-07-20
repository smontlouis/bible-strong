import React, { useEffect, useRef } from 'react'
import { FlatList } from 'react-native'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import styled from '@emotion/native'
import { useTheme } from '@emotion/react'

import FiltersHeader, { getFiltersHeaderLabel } from '~common/FiltersHeader'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'
import { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import verseToReference from '~helpers/verseToReference'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { useAtom, useSetAtom } from 'jotai/react'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import ColorFilterModal from '~common/ColorFilterModal'
import type { SheetRef } from '~common/sheet'
import { unifiedTagsModalAtom } from '~state/app'
import {
  defaultWordAnnotationsListQueryState,
  wordAnnotationsListQueryAtom,
} from '~state/entityListFilters'
import { selectAvailableAnnotationVersions } from '~redux/selectors/bible'
import { sections } from '~assets/bible_versions/books-desc'
import { useColorInfo } from '~helpers/useColorName'
import Container from '~common/ui/Container'
import { getAnnotationGroupVerseKey } from '~features/entityListQuery/wordAnnotationsQuery'
import { isBookInTestament } from '~helpers/bibleBookCatalog'

const TabContainer = styled.View(({ theme }) => ({
  flexDirection: 'row',
  backgroundColor: theme.colors.reverse,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
  paddingHorizontal: 16,
}))

const Tab = styled.TouchableOpacity<{ active: boolean }>(({ theme, active }) => ({
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 2,
  borderBottomColor: active ? theme.colors.primary : 'transparent',
}))

const TabText = styled.Text<{ active: boolean }>(({ theme, active }) => ({
  fontSize: 14,
  fontWeight: active ? 'bold' : 'normal',
  color: active ? theme.colors.primary : theme.colors.tertiary,
}))

const AnnotationCard = styled.TouchableOpacity(({ theme }) => ({
  backgroundColor: theme.colors.reverse,
  marginHorizontal: 16,
  marginVertical: 8,
  padding: 16,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: theme.colors.border,
}))

const AnnotationText = styled.Text(({ theme }) => ({
  fontSize: 16,
  color: theme.colors.default,
  marginBottom: 8,
}))

const AnnotationMeta = styled.Text(({ theme }) => ({
  fontSize: 13,
  color: theme.colors.tertiary,
}))

const EmptyState = styled.View({
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 32,
})

const EmptyText = styled.Text(({ theme }) => ({
  fontSize: 16,
  color: theme.colors.tertiary,
  textAlign: 'center',
}))

const WordAnnotationsScreen = () => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const theme = useTheme()
  const [queryState, setQueryState] = useAtom(wordAnnotationsListQueryAtom)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const colorModalRef = useRef<SheetRef>(null)
  const styleModalRef = useRef<SheetRef>(null)
  const versionModalRef = useRef<SheetRef>(null)
  const testamentModalRef = useRef<SheetRef>(null)
  const bookModalRef = useRef<SheetRef>(null)
  const sortModalRef = useRef<SheetRef>(null)

  // Get all annotations from Redux
  const annotations = useSelector((state: RootState) => state.user.bible.wordAnnotations)
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const versions = useSelector(selectAvailableAnnotationVersions)
  const selectedTag = queryState.tagId ? tags[queryState.tagId] : undefined
  const colorInfo = useColorInfo(queryState.colorId || undefined)
  const books = sections.flatMap(section => section.data)
  const filterLabel = getFiltersHeaderLabel(
    [
      colorInfo?.name,
      selectedTag?.name,
      queryState.annotationType
        ? t(
            queryState.annotationType === 'background'
              ? 'Arrière-plan'
              : queryState.annotationType === 'underline'
                ? 'Souligné'
                : 'Entouré'
          )
        : undefined,
      queryState.version,
      queryState.testament === 'old'
        ? t('Ancien Testament')
        : queryState.testament === 'new'
          ? t('Nouveau Testament')
          : undefined,
      books.find(book => book.Numero === queryState.book)?.Nom,
      queryState.view !== defaultWordAnnotationsListQueryState.view
        ? queryState.view === 'date'
          ? t('Par date')
          : t('Liste')
        : undefined,
      queryState.sort !== defaultWordAnnotationsListQueryState.sort
        ? queryState.sort === 'newest'
          ? t('entityList.sort.newest')
          : t('entityList.sort.oldest')
        : undefined,
    ],
    count => `${count} ${t('filtres')}`
  )

  useEffect(() => {
    if (queryState.tagId && !tags[queryState.tagId]) {
      setQueryState(state => ({ ...state, tagId: null }))
    }
    if (queryState.version && !versions.includes(queryState.version)) {
      setQueryState(state => ({ ...state, version: null }))
    }
    if (queryState.colorId && !colorInfo) {
      setQueryState(state => ({ ...state, colorId: null }))
    }
  }, [
    colorInfo,
    queryState.colorId,
    queryState.tagId,
    queryState.version,
    setQueryState,
    tags,
    versions,
  ])

  // Convert to array and sort
  const annotationsList = (() => {
    const list = Object.entries(annotations).map(([, annotation]) => ({
      ...annotation,
    }))
    const filtered = list.filter(annotation => {
      if (queryState.colorId && annotation.color !== queryState.colorId) return false
      if (queryState.tagId && !annotation.tags?.[queryState.tagId]) return false
      if (queryState.annotationType && annotation.type !== queryState.annotationType) return false
      if (queryState.version && annotation.version !== queryState.version) return false
      const booksInRanges = annotation.ranges.map(range => Number(range.verseKey.split('-')[0]))
      if (queryState.book && !booksInRanges.includes(queryState.book)) return false
      if (
        queryState.testament === 'old' &&
        !booksInRanges.some(book => isBookInTestament(book, 'old'))
      )
        return false
      if (
        queryState.testament === 'new' &&
        !booksInRanges.some(book => isBookInTestament(book, 'new'))
      )
        return false
      return true
    })
    return filtered.sort((left, right) => {
      if (queryState.sort === 'newest')
        return right.date - left.date || left.id.localeCompare(right.id)
      if (queryState.sort === 'oldest')
        return left.date - right.date || left.id.localeCompare(right.id)
      const leftKey = left.ranges
        .map(range => range.verseKey.split('-').map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])[0]
      const rightKey = right.ranges
        .map(range => range.verseKey.split('-').map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])[0]
      return (
        (leftKey?.[0] || 0) - (rightKey?.[0] || 0) ||
        (leftKey?.[1] || 0) - (rightKey?.[1] || 0) ||
        (leftKey?.[2] || 0) - (rightKey?.[2] || 0) ||
        left.id.localeCompare(right.id)
      )
    })
  })()

  // Group by verse
  const groupedByVerse = (() => {
    const groups = new Map<string, typeof annotationsList>()

    annotationsList.forEach(annotation => {
      const verseKey = getAnnotationGroupVerseKey(annotation, {
        book: queryState.book,
        testament: queryState.testament,
      })
      if (!verseKey) return

      if (!groups.has(verseKey)) {
        groups.set(verseKey, [])
      }
      groups.get(verseKey)!.push(annotation)
    })

    const compareVerseKeys = (left: string, right: string) => {
      const leftParts = left.split('-').map(Number)
      const rightParts = right.split('-').map(Number)
      return (
        leftParts[0] - rightParts[0] || leftParts[1] - rightParts[1] || leftParts[2] - rightParts[2]
      )
    }
    const compareDates = (
      left: (typeof annotationsList)[number],
      right: (typeof annotationsList)[number]
    ) =>
      (queryState.sort === 'oldest' ? left.date - right.date : right.date - left.date) ||
      left.id.localeCompare(right.id)

    return Array.from(groups.entries())
      .sort(([left], [right]) => compareVerseKeys(left, right))
      .map(([verseKey, groupedAnnotations]) => ({
        verseKey,
        reference: verseToReference({ [verseKey]: true }),
        annotations: groupedAnnotations.sort(compareDates),
      }))
  })()

  // Group by date
  const groupedByDate = (() => {
    const groups = new Map<string, typeof annotationsList>()

    annotationsList.forEach(annotation => {
      const date = new Date(annotation.date)
      const dateKey = date.toISOString().slice(0, 10)

      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(annotation)
    })

    return Array.from(groups.entries())
      .sort(([left], [right]) =>
        queryState.sort === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)
      )
      .map(([date, groupedAnnotations]) => ({
        date,
        label: new Date(`${date}T12:00:00`).toLocaleDateString(),
        annotations: groupedAnnotations.sort(
          (left, right) => left.date - right.date || left.id.localeCompare(right.id)
        ),
      }))
  })()

  // Handle annotation tap - navigate to Bible verse
  const handleAnnotationPress = (annotation: WordAnnotation & { id: string }) => {
    const firstRange = annotation.ranges[0]
    if (!firstRange) return

    const [book, chapter, verse] = firstRange.verseKey.split('-').map(Number)
    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: String(book),
        chapter: String(chapter),
        verse: String(verse),
      },
    })
  }

  // Render annotation card
  const renderAnnotationCard = (annotation: WordAnnotation & { id: string }) => {
    // Combine all text from ranges
    const allText = annotation.ranges.map(r => r.text).join(' ... ')
    const reference = verseToReference(
      annotation.ranges.reduce((acc, r) => ({ ...acc, [r.verseKey]: true }), {})
    )

    return (
      <AnnotationCard key={annotation.id} onPress={() => handleAnnotationPress(annotation)}>
        <AnnotationText numberOfLines={3}>{allText}</AnnotationText>
        <AnnotationMeta>
          {reference} • {annotation.version}
          {annotation.noteId && ` • ${t('Contient une note')}`}
        </AnnotationMeta>
      </AnnotationCard>
    )
  }

  // Render content based on view mode
  const renderContent = () => {
    if (annotationsList.length === 0) {
      return (
        <EmptyState>
          <EmptyText>
            {Object.keys(annotations).length
              ? t('entityList.noFilterMatch')
              : t("Vous n'avez pas encore annoté de mots...")}
          </EmptyText>
        </EmptyState>
      )
    }

    if (queryState.view === 'verse') {
      return (
        <FlatList
          data={groupedByVerse}
          keyExtractor={item => item.verseKey}
          renderItem={({ item }) => (
            <Box>
              <Box px={16} py={8}>
                <Text fontSize={14} fontWeight="bold" color={theme.colors.tertiary}>
                  {item.reference}
                </Text>
              </Box>
              {item.annotations.map(renderAnnotationCard)}
            </Box>
          )}
        />
      )
    }

    if (queryState.view === 'date') {
      return (
        <FlatList
          data={groupedByDate}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <Box>
              <Box px={16} py={8}>
                <Text fontSize={14} fontWeight="bold" color={theme.colors.tertiary}>
                  {item.label}
                </Text>
              </Box>
              {item.annotations.map(renderAnnotationCard)}
            </Box>
          )}
        />
      )
    }

    // Flat list
    return (
      <FlatList
        data={annotationsList}
        keyExtractor={item => item.id}
        renderItem={({ item }) => renderAnnotationCard(item)}
      />
    )
  }

  return (
    <Container flex bg="lightGrey">
      <FiltersHeader
        title={t('Annotations')}
        filterLabel={filterLabel}
        hasBackButton
        hasActiveFilters={
          JSON.stringify(queryState) !== JSON.stringify(defaultWordAnnotationsListQueryState)
        }
        onReset={() => setQueryState(defaultWordAnnotationsListQueryState)}
        filters={[
          {
            key: 'color',
            icon: 'droplet',
            label: t('Couleur'),
            value: colorInfo?.name || t('Toutes'),
            onPress: () => colorModalRef.current?.present(),
          },
          {
            key: 'tag',
            icon: 'tag',
            label: t('Tags'),
            value: selectedTag?.name || t('Tous'),
            onPress: () =>
              setUnifiedTagsModal({
                mode: 'filter',
                selectedTag,
                onSelect: tag => setQueryState(state => ({ ...state, tagId: tag?.id || null })),
              }),
          },
          {
            key: 'style',
            icon: 'edit-3',
            label: t('Style'),
            value: queryState.annotationType || t('Tous'),
            onPress: () => styleModalRef.current?.present(),
          },
          {
            key: 'version',
            icon: 'book-open',
            label: t('Version'),
            value: queryState.version || t('Toutes'),
            onPress: () => versionModalRef.current?.present(),
          },
          {
            key: 'testament',
            icon: 'book',
            label: t('Testament'),
            value:
              queryState.testament === 'all'
                ? t('Toute la Bible')
                : queryState.testament === 'old'
                  ? t('Ancien Testament')
                  : t('Nouveau Testament'),
            onPress: () => testamentModalRef.current?.present(),
          },
          {
            key: 'book',
            icon: 'bookmark',
            label: t('Livre'),
            value: books.find(book => book.Numero === queryState.book)?.Nom || t('Tous'),
            onPress: () => bookModalRef.current?.present(),
          },
          {
            key: 'sort',
            icon: 'list',
            label: t('Ordre'),
            value:
              queryState.sort === 'bible'
                ? t('Ordre biblique')
                : queryState.sort === 'newest'
                  ? t('entityList.sort.newest')
                  : t('entityList.sort.oldest'),
            onPress: () => sortModalRef.current?.present(),
          },
        ]}
      />
      <ColorFilterModal
        ref={colorModalRef}
        selectedColorId={queryState.colorId || undefined}
        onSelect={colorId => {
          setQueryState(state => ({ ...state, colorId: colorId || null }))
          colorModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={styleModalRef}
        title={t('Style')}
        selectedValue={queryState.annotationType || 'all'}
        options={[
          { value: 'all', label: t('Tous') },
          { value: 'background', label: t('Arrière-plan') },
          { value: 'underline', label: t('Souligné') },
          { value: 'circle', label: t('Entouré') },
        ]}
        onSelect={annotationType => {
          setQueryState(state => ({
            ...state,
            annotationType:
              annotationType === 'all' ? null : (annotationType as typeof state.annotationType),
          }))
          styleModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={versionModalRef}
        title={t('Version')}
        selectedValue={queryState.version || 'all'}
        options={[
          { value: 'all', label: t('Toutes') },
          ...versions.map(value => ({ value, label: value })),
        ]}
        onSelect={version => {
          setQueryState(state => ({ ...state, version: version === 'all' ? null : version }))
          versionModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={testamentModalRef}
        title={t('Testament')}
        selectedValue={queryState.testament}
        options={[
          { value: 'all', label: t('Toute la Bible') },
          { value: 'old', label: t('Ancien Testament') },
          { value: 'new', label: t('Nouveau Testament') },
        ]}
        onSelect={testament => {
          setQueryState(state => ({
            ...state,
            testament,
            book:
              state.book &&
              ((testament === 'old' && !isBookInTestament(state.book, 'old')) ||
                (testament === 'new' && !isBookInTestament(state.book, 'new')))
                ? null
                : state.book,
          }))
          testamentModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={bookModalRef}
        title={t('Livre')}
        selectedValue={String(queryState.book || 0)}
        options={[
          { value: '0', label: t('Tous') },
          ...books
            .filter(
              book =>
                queryState.testament === 'all' ||
                isBookInTestament(book.Numero, queryState.testament)
            )
            .map(book => ({ value: String(book.Numero), label: book.Nom })),
        ]}
        onSelect={book => {
          const number = Number(book) || null
          setQueryState(state => ({
            ...state,
            book: number,
            testament: number
              ? isBookInTestament(number, 'new')
                ? 'new'
                : 'old'
              : state.testament,
          }))
          bookModalRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={sortModalRef}
        title={t('Ordre')}
        selectedValue={queryState.sort}
        options={[
          { value: 'bible', label: t('Ordre biblique') },
          { value: 'newest', label: t('entityList.sort.newest') },
          { value: 'oldest', label: t('entityList.sort.oldest') },
        ]}
        onSelect={sort => {
          setQueryState(state => ({ ...state, sort }))
          sortModalRef.current?.dismiss()
        }}
      />

      <TabContainer>
        <Tab
          active={queryState.view === 'verse'}
          onPress={() => setQueryState(state => ({ ...state, view: 'verse' }))}
        >
          <TabText active={queryState.view === 'verse'}>{t('Par verset')}</TabText>
        </Tab>
        <Tab
          active={queryState.view === 'date'}
          onPress={() => setQueryState(state => ({ ...state, view: 'date' }))}
        >
          <TabText active={queryState.view === 'date'}>{t('Par date')}</TabText>
        </Tab>
        <Tab
          active={queryState.view === 'flat'}
          onPress={() => setQueryState(state => ({ ...state, view: 'flat' }))}
        >
          <TabText active={queryState.view === 'flat'}>{t('Liste')}</TabText>
        </Tab>
      </TabContainer>

      {renderContent()}
    </Container>
  )
}

export default WordAnnotationsScreen
