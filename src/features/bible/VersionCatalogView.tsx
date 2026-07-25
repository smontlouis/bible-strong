import React from 'react'
import { SectionList, TouchableOpacity, type SectionListRenderItem } from 'react-native'
import { useNavigation } from 'expo-router'
import { useAtom, useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'

import ChoiceFilterModal from '~common/ChoiceFilterModal'
import FiltersHeader from '~common/FiltersHeader'
import SearchFilterModal from '~common/SearchFilterModal'
import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { type TranslationReadingProfile, type Version } from '~helpers/bibleVersions'
import useLanguage from '~helpers/useLanguage'
import { installedVersionsSignalAtom } from '~state/app'
import { bibleVersionGroupingAtom } from './versionCatalogState'
import { getDownloadedBibleVersionIds } from './versionAvailability'
import {
  filterVersionCatalogByAvailability,
  getVersionCatalogLocation,
  getVersionCatalogSections,
  type BibleVersionAvailability,
  type BibleVersionGrouping,
  type VersionCatalogLabels,
  type VersionCatalogItem,
  type VersionCatalogSection,
} from './versionCatalog'

const STYLE_INFO_KEYS: Record<TranslationReadingProfile, string> = {
  'word-for-word': 'versionCatalog.style.wordForWord.description',
  balanced: 'versionCatalog.style.balanced.description',
  'thought-for-thought': 'versionCatalog.style.thoughtForThought.description',
  paraphrase: 'versionCatalog.style.paraphrase.description',
}

const EMPTY_DOWNLOADED_VERSION_IDS = new Set<string>()
const ESTIMATED_CATALOG_ROW_HEIGHT = 72

export const useVersionCatalog = (
  catalog: Version[],
  { resetSearchOnFocus = false }: { resetSearchOnFocus?: boolean } = {}
) => {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const uiLanguage = useLanguage()
  const installedVersionsSignal = useAtomValue(installedVersionsSignalAtom)
  const [grouping, setGrouping] = useAtom(bibleVersionGroupingAtom)
  const [query, setQuery] = React.useState('')
  const [availability, setAvailability] = React.useState<BibleVersionAvailability>('all')
  const [downloadedVersionIds, setDownloadedVersionIds] =
    React.useState<ReadonlySet<string> | null>(null)
  const [activeStyleInfo, setActiveStyleInfo] = React.useState<TranslationReadingProfile | null>(
    null
  )
  const [focusKey, setFocusKey] = React.useState(0)
  const searchRef = React.useRef<SheetRef>(null)
  const groupingRef = React.useRef<SheetRef>(null)
  const availabilityRef = React.useRef<SheetRef>(null)
  const styleInfoRef = React.useRef<SheetRef>(null)

  const labels: VersionCatalogLabels = {
    languages: {
      fr: t('versionCatalog.language.fr'),
      en: t('versionCatalog.language.en'),
      he: t('versionCatalog.language.he'),
      grc: t('versionCatalog.language.grc'),
      'he-grc': t('versionCatalog.language.heGrc'),
      la: t('versionCatalog.language.la'),
    },
    profiles: {
      'word-for-word': t('versionCatalog.style.wordForWord'),
      balanced: t('versionCatalog.style.balanced'),
      'thought-for-thought': t('versionCatalog.style.thoughtForThought'),
      paraphrase: t('versionCatalog.style.paraphrase'),
    },
    other: t('versionCatalog.style.other'),
  }
  const groupingLabels: Record<BibleVersionGrouping, string> = {
    alphabetical: t('versionCatalog.grouping.alphabetical'),
    language: t('versionCatalog.grouping.language'),
    style: t('versionCatalog.grouping.style'),
  }
  const availabilityLabels: Record<BibleVersionAvailability, string> = {
    all: t('versionCatalog.availability.all'),
    downloaded: t('versionCatalog.availability.downloaded'),
  }
  const visibleCatalog = filterVersionCatalogByAvailability(
    catalog,
    availability,
    downloadedVersionIds ?? EMPTY_DOWNLOADED_VERSION_IDS
  )
  const sections = getVersionCatalogSections({
    catalog: visibleCatalog,
    grouping,
    query,
    uiLanguage,
    labels,
  })
  const filterKey = `${grouping}:${availability}:${query.trim()}`
  const reset = () => {
    setQuery('')
    setGrouping('language')
    setAvailability('all')
  }

  const resetSearch = () => setQuery('')

  React.useEffect(() => {
    if (!resetSearchOnFocus) return

    const handleFocus = () => {
      setQuery('')
      setFocusKey(current => current + 1)
    }
    handleFocus()
    const unsubscribe = navigation.addListener('focus', handleFocus)
    return () => unsubscribe()
  }, [navigation, resetSearchOnFocus])

  React.useEffect(() => {
    let cancelled = false

    getDownloadedBibleVersionIds(installedVersionsSignal).then(versionIds => {
      if (cancelled) return
      setDownloadedVersionIds(versionIds)
    })

    return () => {
      cancelled = true
    }
  }, [installedVersionsSignal])

  const openStyleInfo = (readingProfile: TranslationReadingProfile) => {
    setActiveStyleInfo(readingProfile)
    styleInfoRef.current?.present()
  }

  const headerProps = {
    onReset: reset,
    filters: [
      {
        key: 'search',
        icon: 'search' as const,
        label: t('Rechercher'),
        value: query.trim() || undefined,
        active: Boolean(query.trim()),
        onPress: () => searchRef.current?.present(),
      },
      {
        key: 'grouping',
        icon: 'list' as const,
        label: t('versionCatalog.groupBy'),
        value: groupingLabels[grouping],
        active: grouping !== 'language',
        onPress: () => groupingRef.current?.present(),
      },
      {
        key: 'availability',
        icon: 'download' as const,
        label: t('versionCatalog.availability.label'),
        value: availabilityLabels[availability],
        active: availability !== 'all',
        onPress: () => availabilityRef.current?.present(),
      },
    ],
  }

  const modals = (
    <>
      <SearchFilterModal
        ref={searchRef}
        title={t('Rechercher')}
        placeholder={t('versionCatalog.searchPlaceholder')}
        value={query}
        onChange={setQuery}
      />
      <ChoiceFilterModal
        ref={groupingRef}
        title={t('versionCatalog.groupBy')}
        selectedValue={grouping}
        options={(['language', 'alphabetical', 'style'] as const).map(value => ({
          value,
          label: groupingLabels[value],
        }))}
        onSelect={value => {
          setGrouping(value)
          groupingRef.current?.dismiss()
        }}
      />
      <ChoiceFilterModal
        ref={availabilityRef}
        title={t('versionCatalog.availability.label')}
        selectedValue={availability}
        options={(['all', 'downloaded'] as const).map(value => ({
          value,
          label: availabilityLabels[value],
        }))}
        onSelect={value => {
          setAvailability(value)
          availabilityRef.current?.dismiss()
        }}
      />
      <Sheet
        ref={styleInfoRef}
        header={
          <SheetHeader
            title={activeStyleInfo ? labels.profiles[activeStyleInfo] : undefined}
            centerTitle
          />
        }
      >
        <SheetView px={20} pt={8} pb={24}>
          {activeStyleInfo && (
            <Text fontSize={16} lineHeight={24}>
              {t(STYLE_INFO_KEYS[activeStyleInfo])}
            </Text>
          )}
        </SheetView>
      </Sheet>
    </>
  )

  return {
    focusKey,
    filterKey,
    availability,
    grouping,
    headerProps,
    modals,
    openStyleInfo,
    query,
    resetSearch,
    sections,
  }
}

type VersionCatalogHeaderProps = ReturnType<typeof useVersionCatalog>['headerProps'] & {
  title: string
  hasBackButton?: boolean
}

export const VersionCatalogHeader = ({
  title,
  hasBackButton,
  ...headerProps
}: VersionCatalogHeaderProps) => (
  <FiltersHeader title={title} hasBackButton={hasBackButton} {...headerProps} />
)

type VersionCatalogListProps = {
  sections: VersionCatalogSection[]
  grouping: BibleVersionGrouping
  query: string
  renderItem: SectionListRenderItem<VersionCatalogItem, VersionCatalogSection>
  openStyleInfo: (readingProfile: TranslationReadingProfile) => void
  bottomInset?: number
  revealVersionId?: string
  revealKey?: number
  scrollToTopKey?: string | number
  listHeaderComponent?: React.ReactElement
}

const scrollToCatalogVersion = (
  list: SectionList<VersionCatalogItem, VersionCatalogSection> | null,
  sections: VersionCatalogSection[],
  versionId: string
) => {
  const location = getVersionCatalogLocation(sections, versionId)
  if (!location) return false

  list?.scrollToLocation({
    ...location,
    animated: false,
    viewPosition: 0.5,
  })
  return true
}

const getEstimatedCatalogOffset = (sections: VersionCatalogSection[], versionId: string) => {
  const location = getVersionCatalogLocation(sections, versionId)
  if (!location) return null

  const precedingItemCount = sections
    .slice(0, location.sectionIndex)
    .reduce((count, section) => count + section.data.length + 1, 0)

  return (precedingItemCount + location.itemIndex) * ESTIMATED_CATALOG_ROW_HEIGHT
}

const scheduleCatalogVersionReveal = (
  list: SectionList<VersionCatalogItem, VersionCatalogSection> | null,
  sections: VersionCatalogSection[],
  versionId: string,
  onRevealed: () => void
) => {
  const estimatedOffset = getEstimatedCatalogOffset(sections, versionId)
  if (estimatedOffset === null) return null

  list?.getScrollResponder()?.scrollTo({
    animated: false,
    y: estimatedOffset,
  })

  return requestAnimationFrame(() => {
    if (scrollToCatalogVersion(list, sections, versionId)) {
      onRevealed()
    }
  })
}

export const VersionCatalogList = ({
  sections,
  grouping,
  query,
  renderItem,
  openStyleInfo,
  bottomInset = 0,
  revealVersionId,
  revealKey = 0,
  scrollToTopKey,
  listHeaderComponent,
}: VersionCatalogListProps) => {
  const { t } = useTranslation()
  const listRef = React.useRef<SectionList<VersionCatalogItem, VersionCatalogSection>>(null)
  const listHeightRef = React.useRef(0)
  const previousScrollToTopKeyRef = React.useRef(scrollToTopKey)
  const [pendingReveal, setPendingReveal] = React.useState(Boolean(revealVersionId))

  React.useEffect(() => {
    setPendingReveal(Boolean(revealVersionId))
  }, [revealKey, revealVersionId])

  React.useEffect(() => {
    if (scrollToTopKey === undefined) return
    if (previousScrollToTopKeyRef.current === scrollToTopKey) return

    previousScrollToTopKeyRef.current = scrollToTopKey

    const frame = requestAnimationFrame(() => {
      listRef.current?.getScrollResponder()?.scrollTo({ animated: false, y: 0 })
    })
    return () => cancelAnimationFrame(frame)
  }, [scrollToTopKey])

  React.useEffect(() => {
    if (!pendingReveal || !revealVersionId || listHeightRef.current <= 0) return

    const frame = scheduleCatalogVersionReveal(listRef.current, sections, revealVersionId, () =>
      setPendingReveal(false)
    )

    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [pendingReveal, revealVersionId, sections])

  function revealSelectedVersion() {
    if (!pendingReveal || !revealVersionId || listHeightRef.current <= 0) return

    scheduleCatalogVersionReveal(listRef.current, sections, revealVersionId, () =>
      setPendingReveal(false)
    )
  }

  return (
    <SectionList<VersionCatalogItem, VersionCatalogSection>
      ref={listRef}
      contentContainerStyle={{
        paddingTop: 0,
        paddingBottom: bottomInset,
        flexGrow: sections.length ? undefined : 1,
      }}
      stickySectionHeadersEnabled
      sections={sections}
      keyExtractor={item => item.id}
      initialNumToRender={44}
      getItemLayout={(_, index) => ({
        index,
        length: ESTIMATED_CATALOG_ROW_HEIGHT,
        offset: ESTIMATED_CATALOG_ROW_HEIGHT * index,
      })}
      onLayout={event => {
        listHeightRef.current = event.nativeEvent.layout.height
        revealSelectedVersion()
      }}
      onContentSizeChange={revealSelectedVersion}
      onScrollToIndexFailed={({ averageItemLength, index }) => {
        setPendingReveal(Boolean(revealVersionId))
        listRef.current?.getScrollResponder()?.scrollTo({
          animated: false,
          y: (averageItemLength || ESTIMATED_CATALOG_ROW_HEIGHT) * index,
        })
      }}
      ListHeaderComponent={listHeaderComponent}
      renderSectionHeader={({ section }) => {
        if (grouping === 'alphabetical') return null
        return (
          <Box
            minHeight={48}
            paddingLeft={20}
            paddingRight={8}
            row
            alignItems="center"
            bg="lightGrey"
            borderBottomWidth={1}
            borderColor="border"
          >
            <Text flex fontSize={16} opacity={0.8}>
              {section.title}
            </Text>
            {grouping === 'style' && section.readingProfile && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('versionCatalog.styleInfo', { style: section.title })}
                hitSlop={12}
                style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
                onPress={() => openStyleInfo(section.readingProfile!)}
              >
                <FeatherIcon name="info" size={16} color="tertiary" />
              </TouchableOpacity>
            )}
          </Box>
        )
      }}
      renderItem={renderItem}
      ListEmptyComponent={
        <Box flex center px={32}>
          <FeatherIcon name="search" size={28} color="tertiary" />
          <Text mt={12} fontSize={16} color="tertiary" textAlign="center">
            {query.trim()
              ? t('Aucun résultat trouvé pour "{{query}}"', { query: query.trim() })
              : t('Aucun résultat')}
          </Text>
        </Box>
      }
    />
  )
}
