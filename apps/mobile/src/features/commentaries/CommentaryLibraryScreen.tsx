import {
  COMMENTARY_CATALOG,
  type CommentaryCatalogEntry,
  type CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useAtomValue } from 'jotai/react'
import React from 'react'
import { SectionList, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import FiltersHeader from '~common/FiltersHeader'
import MultipleChoiceFilterModal from '~common/MultipleChoiceFilterModal'
import SearchFilterModal from '~common/SearchFilterModal'
import { type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getLocalResourceAvailability } from '~features/resources/resourceAvailability'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { installedVersionsSignalAtom } from '~state/app'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
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
  const { t } = useTranslation()
  const installedSignal = useAtomValue(installedVersionsSignalAtom)
  const completionSignal = useAtomValue(downloadCompletionSignalAtom)
  const { entry, language } = projection
  const identity = {
    kind: 'commentary' as const,
    resourceId: entry.publicationId,
    language,
  }
  const itemId = createOfflineCopyId(identity)
  const availability = useQuery({
    queryKey: ['commentary-library-availability', itemId, installedSignal, completionSignal],
    queryFn: () => getLocalResourceAvailability(identity),
    networkMode: 'always',
  })
  const installed = availability.data?.status === 'available'

  return (
    <Box
      minHeight={78}
      px={18}
      py={11}
      bg="reverse"
      row
      alignItems="center"
      borderBottomWidth={1}
      borderColor="border"
    >
      <TouchableOpacity style={{ flex: 1 }} onPress={onOpen} accessibilityRole="button">
        <Box row alignItems="center">
          <CommentaryAvatar
            resourceCode={`${entry.publicationId}:${language}`}
            author={entry.author}
            fallback={entry.shortName}
            size={48}
          />
          <Box ml={13} flex>
            <Text bold fontSize={16} numberOfLines={2}>
              {entry.title}
            </Text>
            <Text mt={3} color="grey" fontSize={12} numberOfLines={1}>
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
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={t('commentaries.details.manage', {
          commentary: entry.title,
        })}
      >
        <Box width={46} height={48} center>
          <FeatherIcon name="more-horizontal" size={20} />
        </Box>
      </TouchableOpacity>
    </Box>
  )
}

const CommentaryLibraryScreen = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const detailsRef = React.useRef<SheetRef>(null)
  const searchRef = React.useRef<SheetRef>(null)
  const traditionsRef = React.useRef<SheetRef>(null)
  const currentsRef = React.useRef<SheetRef>(null)
  const [detailsProjection, setDetailsProjection] = React.useState<Projection>()
  const [query, setQuery] = React.useState('')
  const [traditions, setTraditions] = React.useState<string[]>([])
  const [currents, setCurrents] = React.useState<string[]>([])
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const sections = (['fr', 'en'] as const)
    .map(language => ({
      title: t(`versionCatalog.language.${language}`),
      data: COMMENTARY_CATALOG.flatMap(entry => {
        if (!entry.languages.includes(language)) return []
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
      <Box flex bg="lightGrey">
        <FiltersHeader
          title={t('Commentaires')}
          hasBackButton
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
        <SectionList<Projection>
          sections={sections}
          stickySectionHeadersEnabled
          keyExtractor={item => createCommentaryProjectionId(item.entry.id, item.language)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderSectionHeader={({ section }) => (
            <Box px={20} py={11} bg="lightGrey" borderBottomWidth={1} borderColor="border">
              <Text bold color="grey" fontSize={13}>
                {section.title}
              </Text>
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
          onToggle={value =>
            setCurrents(selected => toggleCommentaryTaxonomyFilter(selected, value))
          }
        />
        <CommentaryOfflineDetailsSheet sheetRef={detailsRef} projection={detailsProjection} />
      </Box>
    </FormSheetScreen>
  )
}

export default CommentaryLibraryScreen
