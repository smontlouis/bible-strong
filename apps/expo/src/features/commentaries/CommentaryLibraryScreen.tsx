import CommentaryDetailsTrigger from './CommentaryDetailsTrigger'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import { pageContentStyle } from '~common/ui/PageContent'
import {
  COMMENTARY_CATALOG,
  type CommentaryCatalogEntry,
  type CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
import { useRouter } from 'expo-router'
import React from 'react'
import { Platform, SectionList, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FiltersHeader from '~common/FiltersHeader'
import { type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useIsOfflineResourceInstalled } from '~features/resources/useOfflineResourceRegistry'
import CommentaryAvatar from './CommentaryAvatar'
import CommentaryOfflineDetailsSheet from './CommentaryOfflineDetailsSheet'
import {
  COMMENTARY_CURRENTS,
  COMMENTARY_TRADITIONS,
  getCommentaryTaxonomyLabelKey,
  matchesCommentaryTaxonomyFilters,
  toggleCommentaryTaxonomyFilter,
} from './commentaryCatalogFilters'
import { createCommentaryProjectionId } from './commentarySelection'
import type { RootState } from '~redux/modules/reducer'
type CommentarySelectionFilter = 'all' | 'selected'

type Projection = {
  entry: CommentaryCatalogEntry
  language: CommentaryLanguage
}

const CommentaryLibraryItem = ({
  projection,
  onOpen,
  onOpenDetails,
}: {
  projection: Projection
  onOpen: () => void
  onOpenDetails: () => void
}) => {
  const { entry, language } = projection
  const identity = {
    kind: 'commentary' as const,
    resourceId: entry.publicationId,
    language,
  }
  const installed = useIsOfflineResourceInstalled(identity)

  return (
    <Box className="border-continuous overflow-hidden min-h-[78px] px-[18px] py-[11px] bg-reverse flex-row items-center border-b-[1px] border-border">
      <TouchableOpacity style={{ flex: 1 }} onPress={onOpen} accessibilityRole="button">
        <Box className="overflow-hidden border-continuous flex-row items-center">
          <CommentaryAvatar
            resourceCode={`${entry.publicationId}:${language}`}
            author={entry.author}
            fallback={entry.shortName}
            size={48}
          />
          <Box className="overflow-hidden border-continuous ml-[13px] flex-[1]">
            <Text className="font-bold text-[16px]" numberOfLines={2}>
              {entry.title}
            </Text>
            <Text className="mt-[3px] text-grey text-[12px]" numberOfLines={1}>
              {entry.author}
            </Text>
          </Box>
          {installed && Platform.OS !== 'web' && (
            <Box className="overflow-hidden border-continuous w-[30px] h-[28px] items-center justify-center">
              <FeatherIcon name="cloud" size={18} color="primary" />
            </Box>
          )}
        </Box>
      </TouchableOpacity>
      <CommentaryDetailsTrigger projection={projection} onPress={onOpenDetails} />
    </Box>
  )
}

const CommentaryLibraryScreen = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const detailsRef = React.useRef<SheetRef>(null)
  const selectedCommentaries = useSelector(
    (state: RootState) => state.user.bible.settings.commentarySelection
  )
  const [detailsProjection, setDetailsProjection] = React.useState<Projection>()
  const [query, setQuery] = React.useState('')
  const [traditions, setTraditions] = React.useState<string[]>([])
  const [currents, setCurrents] = React.useState<string[]>([])
  const [selectionFilter, setSelectionFilter] = React.useState<CommentarySelectionFilter>('all')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const selectedCommentaryIds = new Set(selectedCommentaries)
  const sections = (['fr', 'en'] as const)
    .map(language => ({
      title: t(`versionCatalog.language.${language}`),
      data: COMMENTARY_CATALOG.flatMap(entry => {
        if (!entry.languages.includes(language)) return []
        const projectionId = createCommentaryProjectionId(entry.id, language)
        if (selectionFilter === 'selected' && !selectedCommentaryIds.has(projectionId)) return []
        if (!matchesCommentaryTaxonomyFilters(entry, traditions, currents)) return []
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
        if (normalizedQuery && !searchable.includes(normalizedQuery)) return []
        return [{ entry, language }]
      }),
    }))
    .filter(section => section.data.length > 0)

  const openDetails = (projection: Projection) => {
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
    <FormSheetScreen isFormSheet={false}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-light-grey">
        <FiltersHeader
          title={t('Commentaires')}
          hasBackButton
          onReset={() => {
            setQuery('')
            setTraditions([])
            setCurrents([])
            setSelectionFilter('all')
          }}
          filters={[
            {
              key: 'search',
              icon: 'search',
              label: t('Rechercher'),
              value: query.trim() || undefined,
              active: Boolean(query.trim()),
              onPress: () => {},
              content: () => <PanelSearch value={query} onChange={setQuery} />,
            },
            {
              key: 'selection',
              icon: 'check-square',
              label: t('commentaries.filters.selection'),
              value:
                selectionFilter === 'selected'
                  ? t('commentaries.filters.selectedCount', {
                      count: selectedCommentaries.length,
                    })
                  : t('Tous'),
              active: selectionFilter === 'selected',
              onPress: () => {},
              options: (['all', 'selected'] as const).map(value => ({
                key: value,
                label: value === 'all' ? t('Tous') : t('commentaries.filters.selected'),
                selected: selectionFilter === value,
                onSelect: () => setSelectionFilter(value),
              })),
            },
            {
              key: 'traditions',
              icon: 'book-open',
              label: t('commentaries.filters.traditions'),
              value: selectionSummary(traditions, t('Toutes')),
              active: traditions.length > 0,
              onPress: () => {},
              showCheckbox: true,
              options: COMMENTARY_TRADITIONS.map(value => ({
                key: value,
                label: taxonomyLabel(value),
                selected: traditions.includes(value),
                onSelect: () =>
                  setTraditions(selected => toggleCommentaryTaxonomyFilter(selected, value)),
              })),
            },
            {
              key: 'currents',
              icon: 'tag',
              label: t('commentaries.filters.currents'),
              value: selectionSummary(currents, t('Tous')),
              active: currents.length > 0,
              onPress: () => {},
              showCheckbox: true,
              options: COMMENTARY_CURRENTS.map(value => ({
                key: value,
                label: taxonomyLabel(value),
                selected: currents.includes(value),
                onSelect: () =>
                  setCurrents(selected => toggleCommentaryTaxonomyFilter(selected, value)),
              })),
            },
          ]}
        />
        <SectionList<Projection>
          sections={sections}
          stickySectionHeadersEnabled
          keyExtractor={item => createCommentaryProjectionId(item.entry.id, item.language)}
          contentContainerStyle={[pageContentStyle, { paddingBottom: insets.bottom + 20 }]}
          renderSectionHeader={({ section }) => (
            <Box className="overflow-hidden border-continuous px-[20px] py-[11px] bg-light-grey border-b-[1px] border-border">
              <Text className="font-bold text-grey text-[13px]">{section.title}</Text>
            </Box>
          )}
          renderItem={({ item }) => {
            const projectionId = createCommentaryProjectionId(item.entry.id, item.language)
            return (
              <CommentaryLibraryItem
                projection={item}
                onOpen={() =>
                  router.push({
                    pathname: '/commentary-chapter',
                    params: { projectionId, book: '1', chapter: '1' },
                  })
                }
                onOpenDetails={() => openDetails(item)}
              />
            )
          }}
        />
        <CommentaryOfflineDetailsSheet sheetRef={detailsRef} projection={detailsProjection} />
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryLibraryScreen
