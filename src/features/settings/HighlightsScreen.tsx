import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useAtom, useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert, FlatList } from 'react-native'

import { ActionSheetItem } from '~common/ActionMenu'
import Empty from '~common/Empty'
import FiltersHeader, { getFiltersHeaderLabel } from '~common/FiltersHeader'
import ColorFilterModal from '~common/ColorFilterModal'
import TypeFilterModal from '~common/TypeFilterModal'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { Sheet, type SheetRef } from '~common/sheet'
import { useHighlightFilters } from '~helpers/useHighlightFilters'
import { useSheet } from '~helpers/useSheet'
import type { RootState } from '~redux/modules/reducer'
import { selectHighlightsObj } from '~redux/selectors/user'
import {
  makeAllWordAnnotationsSelector,
  selectAvailableAnnotationVersions,
  type GroupedWordAnnotation,
} from '~redux/selectors/bible'
import {
  changeHighlightColor,
  type Highlight,
  type HighlightsObj,
  removeHighlight,
} from '~redux/modules/user'
import {
  removeWordAnnotationAction,
  changeWordAnnotationColor,
} from '~redux/modules/user/wordAnnotations'
import { unifiedTagsModalAtom, colorChangeModalAtom } from '../../state/app'
import VerseComponent from './Verse'
import AnnotationItem from './AnnotationItem'
import type { TagsObj, Verse, VerseIds } from '~common/types'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import ChoiceFilterModal from '~common/ChoiceFilterModal'
import { highlightsListQueryAtom } from '~state/entityListFilters'
import { sections } from '~assets/bible_versions/books-desc'

export type GroupedHighlightData = {
  date: number
  color: string
  highlightsObj: Verse[]
  stringIds: VerseIds
  tags: TagsObj
}

export type GroupedHighlights = GroupedHighlightData[]

type UnifiedHighlightItem =
  | { type: 'highlight'; data: GroupedHighlightData }
  | { type: 'annotation'; data: GroupedWordAnnotation }

const filterByTag =
  (tagId: string, highlightsObj: HighlightsObj) =>
  ([vId]: [string, Highlight]) =>
    Boolean(highlightsObj[vId].tags && highlightsObj[vId].tags[tagId])

const groupHighlightsByDate = (arr: GroupedHighlights, highlightTuple: [string, Highlight]) => {
  const [highlightId, highlight] = highlightTuple
  const [Livre, Chapitre, Verset] = highlightId.split('-').map(Number)
  const formattedVerse = { Livre, Chapitre, Verset, Texte: '' }

  if (!arr.find(a => a.date === highlight.date)) {
    arr.push({
      date: highlight.date,
      color: highlight.color,
      highlightsObj: [],
      stringIds: {},
      tags: {},
    })
  }

  const dateInArray = arr.find(a => a.date === highlight.date)
  if (dateInArray) {
    dateInArray.stringIds[highlightId] = true
    dateInArray.highlightsObj.push(formattedVerse)
    dateInArray.highlightsObj.sort((a, b) => Number(a.Verset) - Number(b.Verset))
    dateInArray.tags = { ...dateInArray.tags, ...highlight.tags }
  }

  arr.sort((a, b) => Number(b.date) - Number(a.date))
  return arr
}

type HighlightsScreenProps = {
  isFormSheet?: boolean
}

const HighlightsScreen = ({ isFormSheet = false }: HighlightsScreenProps) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : true
  const highlightsObj = useSelector(selectHighlightsObj)
  const setUnifiedTagsModal = useSetAtom(unifiedTagsModalAtom)
  const setColorChangeModal = useSetAtom(colorChangeModalAtom)
  const [persistedFilters, setPersistedFilters] = useAtom(highlightsListQueryAtom)
  const testamentModalRef = useRef<SheetRef>(null)
  const bookModalRef = useRef<SheetRef>(null)
  const sortModalRef = useRef<SheetRef>(null)
  const books = sections.flatMap(section => section.data)

  // Word annotations selector
  const selectAllWordAnnotations = makeAllWordAnnotationsSelector()
  const wordAnnotations = useSelector((state: RootState) => selectAllWordAnnotations(state))

  // Available annotation versions for type filter
  const availableAnnotationVersions = useSelector(selectAvailableAnnotationVersions)

  useEffect(() => {
    const typeFilter = persistedFilters.typeFilter
    if (
      typeFilter &&
      !['all', 'highlights', 'annotations'].includes(typeFilter) &&
      !availableAnnotationVersions.includes(typeFilter)
    ) {
      setPersistedFilters(state => ({ ...state, typeFilter: undefined }))
    }
  }, [availableAnnotationVersions, persistedFilters.typeFilter, setPersistedFilters])

  // Filters hook - encapsulates all filter logic
  const {
    filters,
    setColorFilter,
    setTypeFilter,
    resetFilters,
    colorInfo,
    selectedTag,
    typeFilterLabel,
    activeFiltersCount,
    colorModalRef,
    typeModalRef,
    openColorFromMain,
    openTagsFromMain,
    openTypeFromMain,
  } = useHighlightFilters()

  const filterLabel = getFiltersHeaderLabel(
    [
      filters.typeFilter && filters.typeFilter !== 'all' ? typeFilterLabel : undefined,
      colorInfo?.name,
      selectedTag?.name,
      filters.testament === 'old'
        ? t('Ancien Testament')
        : filters.testament === 'new'
          ? t('Nouveau Testament')
          : undefined,
      books.find(book => book.Numero === filters.book)?.Nom,
      filters.sort === 'oldest'
        ? t('entityList.sort.oldest')
        : filters.sort === 'bible'
          ? t('Ordre biblique')
          : undefined,
    ],
    count => `${count} ${t('filtres')}`
  )

  // Settings modal (for highlight actions)
  const [settingsData, setSettingsData] = useState<{ stringIds: VerseIds } | null>(null)
  const { ref: settingsRef, open: openSettings, close: closeSettings } = useSheet()

  // Annotation settings modal
  const [annotationSettingsData, setAnnotationSettingsData] =
    useState<GroupedWordAnnotation | null>(null)
  const {
    ref: annotationSettingsRef,
    open: openAnnotationSettings,
    close: closeAnnotationSettings,
  } = useSheet()

  useEffect(() => {
    if (settingsData) openSettings()
  }, [settingsData, openSettings])

  useEffect(() => {
    if (annotationSettingsData) openAnnotationSettings()
  }, [annotationSettingsData, openAnnotationSettings])

  // Filter highlights
  const groupedHighlights = (() => {
    let highlights = Object.entries(highlightsObj)

    if (filters.colorId) {
      highlights = highlights.filter(([, h]) => h.color === filters.colorId)
    }
    if (filters.tagId) {
      highlights = highlights.filter(filterByTag(filters.tagId, highlightsObj))
    }
    if (filters.book) {
      highlights = highlights.filter(([id]) => Number(id.split('-')[0]) === filters.book)
    } else if (filters.testament === 'old') {
      highlights = highlights.filter(([id]) => Number(id.split('-')[0]) <= 39)
    } else if (filters.testament === 'new') {
      highlights = highlights.filter(([id]) => Number(id.split('-')[0]) >= 40)
    }

    return highlights
      .sort((a, b) => Number(b[1].date) - Number(a[1].date))
      .reduce(groupHighlightsByDate, [])
  })()

  // Create unified list of highlights and annotations sorted by date
  const unifiedItems = (() => {
    // Filter and transform annotations to unified format
    let filteredAnnotations = wordAnnotations
    if (filters.colorId) {
      filteredAnnotations = filteredAnnotations.filter(a => a.color === filters.colorId)
    }
    const tagIdFilter = filters.tagId
    if (tagIdFilter) {
      filteredAnnotations = filteredAnnotations.filter(a => a.tags?.[tagIdFilter])
    }
    if (filters.book) {
      filteredAnnotations = filteredAnnotations.filter(a =>
        a.verseKeys.some(verseKey => Number(verseKey.split('-')[0]) === filters.book)
      )
    } else if (filters.testament === 'old') {
      filteredAnnotations = filteredAnnotations.filter(a =>
        a.verseKeys.some(verseKey => Number(verseKey.split('-')[0]) <= 39)
      )
    } else if (filters.testament === 'new') {
      filteredAnnotations = filteredAnnotations.filter(a =>
        a.verseKeys.some(verseKey => Number(verseKey.split('-')[0]) >= 40)
      )
    }

    // Type filter logic
    const typeFilter = filters.typeFilter

    const highlightItems: UnifiedHighlightItem[] = groupedHighlights.map(h => ({
      type: 'highlight' as const,
      data: h,
    }))
    const annotationItems: UnifiedHighlightItem[] = filteredAnnotations.map(a => ({
      type: 'annotation' as const,
      data: a,
    }))
    const items =
      typeFilter === 'highlights'
        ? highlightItems
        : typeFilter === 'annotations'
          ? annotationItems
          : typeFilter && typeFilter !== 'all'
            ? annotationItems.filter(
                item => item.type === 'annotation' && item.data.version === typeFilter
              )
            : [...highlightItems, ...annotationItems]
    const identity = (item: UnifiedHighlightItem) =>
      item.type === 'annotation'
        ? `annotation-${item.data.id}`
        : `highlight-${Object.keys(item.data.stringIds).sort().join('/')}`

    // Combine and sort by date descending
    return items.sort((a, b) => {
      if (filters.sort === 'oldest') {
        return Number(a.data.date) - Number(b.data.date) || identity(a).localeCompare(identity(b))
      }
      if (filters.sort === 'bible') {
        const key = (item: UnifiedHighlightItem) => {
          const verseKeys =
            item.type === 'highlight' ? Object.keys(item.data.stringIds) : item.data.verseKeys
          return verseKeys
            .map(value => value.split('-').map(Number))
            .sort(
              (left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
            )[0]
        }
        const left = key(a)
        const right = key(b)
        return (
          (left?.[0] || 0) - (right?.[0] || 0) ||
          (left?.[1] || 0) - (right?.[1] || 0) ||
          (left?.[2] || 0) - (right?.[2] || 0) ||
          identity(a).localeCompare(identity(b))
        )
      }
      return Number(b.data.date) - Number(a.data.date) || identity(a).localeCompare(identity(b))
    })
  })()

  const handleDelete = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer cette surbrillance ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          if (settingsData?.stringIds) {
            dispatch(removeHighlight({ selectedVerses: settingsData.stringIds }))
          }
          setSettingsData(null)
          closeSettings()
        },
        style: 'destructive',
      },
    ])
  }

  const handleDeleteAnnotation = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer cette annotation ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          if (annotationSettingsData?.id) {
            dispatch(removeWordAnnotationAction(annotationSettingsData.id))
          }
          setAnnotationSettingsData(null)
          closeAnnotationSettings()
        },
        style: 'destructive',
      },
    ])
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      <Box flex bg="reverse">
        {/* Header with filter button */}
        <FiltersHeader
          title={t('Surbrillances')}
          filterLabel={filterLabel}
          hasBackButton={hasBackButton}
          hasActiveFilters={activeFiltersCount > 0}
          onReset={resetFilters}
          filters={[
            {
              key: 'type',
              icon: 'layers',
              label: t('Type'),
              value: typeFilterLabel || t('Tout'),
              onPress: openTypeFromMain,
            },
            {
              key: 'color',
              icon: 'droplet',
              label: t('Couleur'),
              value: colorInfo?.name || t('Toutes'),
              color: filters.colorId ? colorInfo?.hex : undefined,
              onPress: openColorFromMain,
            },
            {
              key: 'tags',
              icon: 'tag',
              label: t('Tags'),
              value: selectedTag?.name || t('Tous'),
              onPress: openTagsFromMain,
            },
            {
              key: 'testament',
              icon: 'book',
              label: t('Testament'),
              value:
                filters.testament === 'old'
                  ? t('Ancien Testament')
                  : filters.testament === 'new'
                    ? t('Nouveau Testament')
                    : t('Toute la Bible'),
              onPress: () => testamentModalRef.current?.present(),
            },
            {
              key: 'book',
              icon: 'bookmark',
              label: t('Livre'),
              value: books.find(book => book.Numero === filters.book)?.Nom || t('Tous'),
              onPress: () => bookModalRef.current?.present(),
            },
            {
              key: 'sort',
              icon: 'list',
              label: t('Ordre'),
              value:
                filters.sort === 'oldest'
                  ? t('entityList.sort.oldest')
                  : filters.sort === 'bible'
                    ? t('Ordre biblique')
                    : t('entityList.sort.newest'),
              onPress: () => sortModalRef.current?.present(),
            },
          ]}
        />

        <ChoiceFilterModal
          ref={testamentModalRef}
          title={t('Testament')}
          selectedValue={filters.testament || 'all'}
          options={[
            { value: 'all', label: t('Toute la Bible') },
            { value: 'old', label: t('Ancien Testament') },
            { value: 'new', label: t('Nouveau Testament') },
          ]}
          onSelect={testament => {
            setPersistedFilters(state => ({
              ...state,
              testament,
              book:
                state.book &&
                ((testament === 'old' && state.book > 39) ||
                  (testament === 'new' && state.book < 40))
                  ? undefined
                  : state.book,
            }))
            testamentModalRef.current?.dismiss()
          }}
        />
        <ChoiceFilterModal
          ref={bookModalRef}
          title={t('Livre')}
          selectedValue={String(filters.book || 0)}
          options={[
            { value: '0', label: t('Tous') },
            ...books
              .filter(
                book =>
                  !filters.testament ||
                  filters.testament === 'all' ||
                  (filters.testament === 'old' ? book.Numero <= 39 : book.Numero >= 40)
              )
              .map(book => ({ value: String(book.Numero), label: book.Nom })),
          ]}
          onSelect={book => {
            const number = Number(book) || undefined
            setPersistedFilters(state => ({
              ...state,
              book: number,
              testament: number ? (number <= 39 ? 'old' : 'new') : state.testament,
            }))
            bookModalRef.current?.dismiss()
          }}
        />
        <ChoiceFilterModal
          ref={sortModalRef}
          title={t('Ordre')}
          selectedValue={filters.sort || 'newest'}
          options={[
            { value: 'newest', label: t('entityList.sort.newest') },
            { value: 'oldest', label: t('entityList.sort.oldest') },
            { value: 'bible', label: t('Ordre biblique') },
          ]}
          onSelect={sort => {
            setPersistedFilters(state => ({ ...state, sort }))
            sortModalRef.current?.dismiss()
          }}
        />

        <ColorFilterModal
          ref={colorModalRef}
          selectedColorId={filters.colorId}
          onSelect={colorId => {
            setColorFilter(colorId)
            colorModalRef.current?.dismiss()
          }}
        />

        <TypeFilterModal
          ref={typeModalRef}
          selectedType={filters.typeFilter}
          availableVersions={availableAnnotationVersions}
          onSelect={type => {
            setTypeFilter(type)
            typeModalRef.current?.dismiss()
          }}
        />

        {/* Content */}
        {unifiedItems.length ? (
          <FlatList
            data={unifiedItems}
            keyExtractor={item =>
              item.type === 'highlight'
                ? `highlight-${Object.keys(item.data.stringIds).sort().join('/')}`
                : `annotation-${item.data.id}`
            }
            renderItem={({ item }) => {
              if (item.type === 'highlight') {
                return (
                  <VerseComponent
                    color={item.data.color}
                    date={item.data.date}
                    verseIds={item.data.highlightsObj}
                    stringIds={item.data.stringIds}
                    tags={item.data.tags}
                    setSettings={setSettingsData}
                  />
                )
              }

              return <AnnotationItem item={item.data} onSettingsPress={setAnnotationSettingsData} />
            }}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/highlight.svg')}
            message={
              Object.keys(highlightsObj).length || wordAnnotations.length
                ? t('entityList.noFilterMatch')
                : t("Vous n'avez pas encore rien surligné...")
            }
          />
        )}

        {/* Settings modal */}
        <Sheet ref={settingsRef}>
          <ActionSheetItem
            icon="droplet"
            label={t('Changer la couleur')}
            onPress={() => {
              if (settingsData?.stringIds) {
                const verseIds = settingsData.stringIds
                setColorChangeModal({
                  onSelectColor: (colorId: string) => {
                    dispatch(changeHighlightColor(verseIds, colorId))
                  },
                })
              }
            }}
          />
          <ActionSheetItem
            icon="tag"
            label={t('Éditer les tags')}
            onPress={() => {
              if (settingsData?.stringIds) {
                setUnifiedTagsModal({
                  mode: 'select',
                  entity: 'highlights',
                  ids: settingsData.stringIds,
                })
              }
            }}
          />
          <ActionSheetItem
            icon="trash-2"
            label={t('Supprimer')}
            color="quart"
            onPress={handleDelete}
          />
        </Sheet>

        {/* Annotation settings modal */}
        <Sheet ref={annotationSettingsRef} onDismiss={() => setAnnotationSettingsData(null)}>
          <ActionSheetItem
            icon="droplet"
            label={t('Changer la couleur')}
            onPress={() => {
              if (annotationSettingsData) {
                const annotationId = annotationSettingsData.id
                const annotationColor = annotationSettingsData.color
                setColorChangeModal({
                  selectedColor: annotationColor,
                  onSelectColor: (colorId: string) => {
                    dispatch(changeWordAnnotationColor(annotationId, colorId))
                  },
                })
              }
            }}
          />
          <ActionSheetItem
            icon="tag"
            label={t('Éditer les tags')}
            onPress={() => {
              if (annotationSettingsData) {
                setUnifiedTagsModal({
                  mode: 'select',
                  entity: 'wordAnnotations',
                  id: annotationSettingsData.id,
                })
              }
            }}
          />
          <ActionSheetItem
            icon="trash-2"
            label={t('Supprimer')}
            color="quart"
            onPress={handleDeleteAnnotation}
          />
        </Sheet>
      </Box>
    </FormSheetScreen>
  )
}

export default HighlightsScreen
