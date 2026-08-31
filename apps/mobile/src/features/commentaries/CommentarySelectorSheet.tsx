import {
  COMMENTARY_CATALOG,
  type CommentaryCatalogEntry,
  type CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
import { useTheme } from '@emotion/react'
import React from 'react'
import { SectionList, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FiltersHeader from '~common/FiltersHeader'
import MultipleChoiceFilterModal from '~common/MultipleChoiceFilterModal'
import SearchFilterModal from '~common/SearchFilterModal'
import { Sheet, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import CommentaryOfflineDetailsSheet from './CommentaryOfflineDetailsSheet'
import {
  COMMENTARY_CURRENTS,
  COMMENTARY_TRADITIONS,
  getCommentaryTaxonomyLabelKey,
  matchesCommentaryTaxonomyFilters,
  toggleCommentaryTaxonomyFilter,
} from './commentaryCatalogFilters'
import {
  createCommentaryProjectionId,
  MAX_SELECTED_COMMENTARIES,
  parseCommentaryProjectionId,
  reorderCommentarySelection,
  toggleCommentarySelection,
  type CommentaryProjectionId,
} from './commentarySelection'
import SelectedCommentariesHeader from './SelectedCommentariesHeader'
import type { RootState } from '~redux/modules/reducer'
import {
  reorderSettingsCommentarySelection,
  setSettingsCommentarySelection,
} from '~redux/modules/user'

type Props = {
  sheetRef: React.RefObject<SheetRef | null>
}

type CommentaryProjection = {
  entry: CommentaryCatalogEntry
  language: CommentaryLanguage
  projectionId: CommentaryProjectionId
}

type CommentarySection = {
  title: string
  data: CommentaryProjection[]
}

const CommentarySelectorItem = ({
  projection,
  selected,
  installed,
  selectionDisabled,
  onToggle,
  onOpenDetails,
}: {
  projection: CommentaryProjection
  selected: boolean
  installed: boolean
  selectionDisabled: boolean
  onToggle: () => void
  onOpenDetails: () => void
}) => {
  const { t } = useTranslation()
  const { entry } = projection

  return (
    <Box
      minHeight={76}
      pl={20}
      pr={4}
      py={12}
      borderBottomWidth={1}
      borderColor="border"
      borderLeftWidth={selected ? 3 : 0}
      borderLeftColor={selected ? 'primary' : undefined}
    >
      <Box flex row alignItems="center">
        <TouchableOpacity
          style={{ flex: 1 }}
          disabled={selectionDisabled}
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityLabel={`${t('commentaries.selector.title')}: ${entry.title}`}
          accessibilityState={{ checked: selected, disabled: selectionDisabled }}
        >
          <Box flex row alignItems="center" opacity={selectionDisabled ? 0.45 : 1}>
            <Box width={48} minHeight={48} center>
              <Checkbox checked={selected} variant="icon" size={22} />
            </Box>
            <Box flex>
              <Text fontSize={16} bold={selected} numberOfLines={2}>
                {entry.title}
              </Text>
              <Text color="tertiary" fontSize={11} mt={3} numberOfLines={1}>
                {entry.author}
              </Text>
            </Box>
            {installed && (
              <Box width={30} height={28} center>
                <FeatherIcon name="cloud" size={18} color="primary" />
              </Box>
            )}
          </Box>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('commentaries.details.manage', { commentary: entry.title })}
          onPress={event => {
            event.stopPropagation()
            onOpenDetails()
          }}
        >
          <Box width={48} minHeight={48} center>
            <FeatherIcon name="more-horizontal" size={20} color="default" />
          </Box>
        </TouchableOpacity>
      </Box>
    </Box>
  )
}

const CommentarySelectorSheet = ({ sheetRef }: Props) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const resourceRegistry = useOfflineResourceRegistry()
  const selected = useSelector((state: RootState) => state.user.bible.settings.commentarySelection)
  const [query, setQuery] = React.useState('')
  const [traditions, setTraditions] = React.useState<string[]>([])
  const [currents, setCurrents] = React.useState<string[]>([])
  const [limitReached, setLimitReached] = React.useState(false)
  const [detailsProjection, setDetailsProjection] = React.useState<CommentaryProjection>()
  const searchRef = React.useRef<SheetRef>(null)
  const traditionsRef = React.useRef<SheetRef>(null)
  const currentsRef = React.useRef<SheetRef>(null)
  const detailsRef = React.useRef<SheetRef>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const projections = React.useMemo(
    () =>
      COMMENTARY_CATALOG.flatMap(entry =>
        entry.languages.map(language => ({
          entry,
          language,
          projectionId: createCommentaryProjectionId(entry.id, language),
        }))
      ),
    []
  )
  const installedProjectionIds = new Set(
    projections.flatMap(projection => {
      const itemId = createOfflineCopyId({
        kind: 'commentary',
        resourceId: projection.entry.publicationId,
        language: projection.language,
      })
      const availability = resourceRegistry.resources.get(itemId)?.availability
      return availability?.status === 'available' || availability?.status === 'corrupt'
        ? [projection.projectionId]
        : []
    })
  )
  const selectedProjections = React.useMemo(
    () =>
      selected.flatMap(projectionId => {
        const projection = parseCommentaryProjectionId(projectionId)
        if (!projection) return []
        const entry = COMMENTARY_CATALOG.find(candidate => candidate.id === projection.resourceId)
        return entry ? [{ ...projection, entry }] : []
      }),
    [selected]
  )

  const sections: CommentarySection[] = React.useMemo(
    () =>
      (['fr', 'en'] as const)
        .map(language => ({
          title: t(`versionCatalog.language.${language}`),
          data: projections.filter(projection => {
            if (projection.language !== language) return false
            const { entry } = projection
            if (!matchesCommentaryTaxonomyFilters(entry, traditions, currents)) return false
            const searchable = [
              entry.title,
              entry.author,
              entry.shortName,
              entry.tradition,
              ...entry.tags,
              entry.description[language] ?? '',
            ]
              .join(' ')
              .toLocaleLowerCase()
            return !normalizedQuery || searchable.includes(normalizedQuery)
          }),
        }))
        .filter(section => section.data.length > 0),
    [currents, normalizedQuery, projections, t, traditions]
  )

  const toggle = (projectionId: CommentaryProjectionId) => {
    const result = toggleCommentarySelection(selected, projectionId)
    setLimitReached(result.limitReached)
    if (!result.limitReached) dispatch(setSettingsCommentarySelection(result.selected))
  }

  const removeSelection = React.useCallback(
    (projectionId: CommentaryProjectionId) => {
      dispatch(
        setSettingsCommentarySelection(selected.filter(candidate => candidate !== projectionId))
      )
    },
    [dispatch, selected]
  )

  const moveSelection = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      dispatch(
        reorderSettingsCommentarySelection(reorderCommentarySelection(selected, fromIndex, toIndex))
      )
    },
    [dispatch, selected]
  )

  const reorderSelection = React.useCallback(
    (projectionIds: CommentaryProjectionId[]) => {
      dispatch(reorderSettingsCommentarySelection(projectionIds))
    },
    [dispatch]
  )

  const openDetails = (projection: CommentaryProjection) => {
    setDetailsProjection(projection)
    requestAnimationFrame(() => detailsRef.current?.present())
  }

  const taxonomyLabel = (value: string) => t(getCommentaryTaxonomyLabelKey(value))
  const selectionSummary = (values: readonly string[], emptyLabel: string) => {
    if (values.length === 0) return emptyLabel
    if (values.length === 1) return taxonomyLabel(values[0])
    return t('commentaries.filters.selectedCount', { count: values.length })
  }

  return (
    <>
      <Sheet
        ref={sheetRef}
        snapPoints={[1]}
        backgroundColor={theme.colors.reverse}
        scrollableOptions={{ scrollingExpandsSheet: false }}
        onPresent={() => {
          setQuery('')
          setLimitReached(false)
        }}
        header={
          <>
            <FiltersHeader
              title={t('commentaries.selector.title')}
              onReset={() => {
                setQuery('')
                setTraditions([])
                setCurrents([])
              }}
              filters={[
                {
                  key: 'search',
                  icon: 'search',
                  label: t('Rechercher'),
                  value: query.trim() || undefined,
                  active: Boolean(query.trim()),
                  onPress: () => searchRef.current?.present(),
                },
                {
                  key: 'traditions',
                  icon: 'book-open',
                  label: t('commentaries.filters.traditions'),
                  value: selectionSummary(traditions, t('Toutes')),
                  active: traditions.length > 0,
                  onPress: () => traditionsRef.current?.present(),
                },
                {
                  key: 'currents',
                  icon: 'tag',
                  label: t('commentaries.filters.currents'),
                  value: selectionSummary(currents, t('Tous')),
                  active: currents.length > 0,
                  onPress: () => currentsRef.current?.present(),
                },
              ]}
            />
            <SelectedCommentariesHeader
              items={selectedProjections}
              max={MAX_SELECTED_COMMENTARIES}
              onRemove={removeSelection}
              onMove={moveSelection}
              onReorder={reorderSelection}
            />
          </>
        }
      >
        <SectionList<CommentaryProjection, CommentarySection>
          sections={sections}
          stickySectionHeadersEnabled
          keyboardShouldPersistTaps="handled"
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          keyExtractor={item => item.projectionId}
          contentContainerStyle={{
            paddingBottom: insets.bottom,
            flexGrow: sections.length ? undefined : 1,
          }}
          ListHeaderComponent={
            limitReached ? (
              <Box px={20} py={10} bg="lightGrey" borderBottomWidth={1} borderColor="border">
                <Text color="quart" fontSize={12}>
                  {t('commentaries.selector.limit', { max: MAX_SELECTED_COMMENTARIES })}
                </Text>
              </Box>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <Box
              minHeight={48}
              px={20}
              row
              alignItems="center"
              bg="lightGrey"
              borderBottomWidth={1}
              borderColor="border"
            >
              <Text flex fontSize={16} opacity={0.8}>
                {section.title}
              </Text>
            </Box>
          )}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item.projectionId)
            return (
              <CommentarySelectorItem
                projection={item}
                selected={isSelected}
                installed={installedProjectionIds.has(item.projectionId)}
                selectionDisabled={!isSelected && selected.length >= MAX_SELECTED_COMMENTARIES}
                onToggle={() => toggle(item.projectionId)}
                onOpenDetails={() => openDetails(item)}
              />
            )
          }}
          ListEmptyComponent={
            <Box flex center px={32}>
              <FeatherIcon name="search" size={28} color="tertiary" />
              <Text mt={12} fontSize={16} color="tertiary" textAlign="center">
                {t('Aucun résultat trouvé pour "{{query}}"', { query: query.trim() })}
              </Text>
            </Box>
          }
        />
      </Sheet>
      <SearchFilterModal
        ref={searchRef}
        title={t('Rechercher')}
        placeholder={t('commentaries.selector.search')}
        value={query}
        onChange={setQuery}
      />
      <MultipleChoiceFilterModal
        ref={traditionsRef}
        title={t('commentaries.filters.traditions')}
        selectedValues={traditions}
        options={COMMENTARY_TRADITIONS.map(value => ({ value, label: taxonomyLabel(value) }))}
        onToggle={value =>
          setTraditions(selected => toggleCommentaryTaxonomyFilter(selected, value))
        }
      />
      <MultipleChoiceFilterModal
        ref={currentsRef}
        title={t('commentaries.filters.currents')}
        selectedValues={currents}
        options={COMMENTARY_CURRENTS.map(value => ({ value, label: taxonomyLabel(value) }))}
        onToggle={value => setCurrents(selected => toggleCommentaryTaxonomyFilter(selected, value))}
      />
      <CommentaryOfflineDetailsSheet sheetRef={detailsRef} projection={detailsProjection} />
    </>
  )
}

export default CommentarySelectorSheet
