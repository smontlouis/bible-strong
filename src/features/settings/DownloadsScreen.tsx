import React, { useState } from 'react'
import { Alert, TextInput, TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useAtomValue } from 'jotai/react'

import Header from '~common/Header'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import SectionList from '~common/ui/SectionList'
import { FeatherIcon } from '~common/ui/Icon'

import DownloadableItem from './components/DownloadableItem'
import StorageSummaryCard from './components/StorageSummaryCard'
import FilterChipRow, { type StatusFilter, type LangFilter } from './components/FilterChipRow'
import DownloadSectionHeader from './components/DownloadSectionHeader'
import GlobalDownloadBar from './components/GlobalDownloadBar'
import BatchActionBar from './components/BatchActionBar'

import { versions, isStrongVersion, type Version } from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  FRENCH_ONLY_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from '~helpers/databaseTypes'
import { isLocalResourceAvailable } from '~features/resources/resourceAvailability'
import {
  createBibleDownloadItem,
  createDatabaseDownloadItem,
  createStrongSidecarDownloadPlan,
  createInterlinearSidecarDownloadPlan,
  dedupeDownloadItems,
} from '~helpers/downloadItemFactory'
import { useDownloadQueue } from '~helpers/useDownloadQueue'
import { installedVersionsSignalAtom } from '~state/app'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import { getDefaultStore } from 'jotai/vanilla'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import {
  getStrongBibleAttributionKey,
  getStrongBiblePublication,
  isStrongCapableBibleVersion,
  STRONG_BIBLE_PUBLICATIONS,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import {
  createDownloadedItemDeletionPlan,
  deleteDownloadedItem,
} from '~helpers/deleteDownloadedItem'
import { buildBibleVersionGroups, getStrongIndexBibleName } from './downloadVersionGroups'
import { BHG_INTERLINEAR_PUBLICATION } from '~helpers/interlinearBiblePublications'
import {
  getInterlinearSidecarAvailability,
  type InterlinearSidecarAvailability,
} from '~helpers/interlinearBibleSidecar'

// ---------------------------------------------------------------------------
// Unified section item type
// ---------------------------------------------------------------------------

interface UnifiedItem {
  id: string // itemId for DownloadableItem, e.g. "bible:LSG" or "database:STRONG:fr"
  name: string
  subtitle?: string
  parentItemId?: string
  estimatedSize: number
  lang: 'fr' | 'en' | 'other'
  searchText: string // for search filtering
}

interface UnifiedSection {
  key: string
  title: string
  data: UnifiedItem[]
}

// ---------------------------------------------------------------------------
// Build unified sections
// ---------------------------------------------------------------------------

function buildDatabaseItems(lang: ResourceLanguage): UnifiedItem[] {
  const allDbs = databases(lang)
  return LANGUAGE_SPECIFIC_DBS.filter(dbId => dbId !== 'INTERLINEAIRE' && dbId !== 'TIMELINE')
    .filter(dbId => (lang === 'en' ? !FRENCH_ONLY_DBS.includes(dbId) : true))
    .map(dbId => {
      const db = allDbs[dbId as keyof typeof allDbs]
      if (!db) return null
      return {
        id: `database:${dbId}:${lang}`,
        name: db.name,
        subtitle: db.desc,
        estimatedSize: db.fileSize,
        lang: lang as 'fr' | 'en',
        searchText: `${db.name} ${db.desc} ${dbId}`.toLowerCase(),
      }
    })
    .filter(Boolean) as UnifiedItem[]
}

function buildSharedDatabaseItems(): UnifiedItem[] {
  const allDbs = databases('fr')
  return SHARED_DBS.filter(dbId => dbId !== 'BIBLES' && dbId in allDbs).map(dbId => {
    const db = allDbs[dbId as keyof typeof allDbs]
    return {
      id: `database:${dbId}:fr`, // shared use fr as default
      name: db.name,
      subtitle: db.desc,
      estimatedSize: db.fileSize,
      lang: 'fr' as const,
      searchText: `${db.name} ${db.desc} ${dbId}`.toLowerCase(),
    }
  })
}

function buildBibleItems(
  versionList: Version[],
  appLang: string,
  t: (key: string, options?: Record<string, unknown>) => string
): UnifiedItem[] {
  return versionList.flatMap(v => {
    const displayName = appLang === 'en' && v.name_en ? v.name_en : v.name
    const base: UnifiedItem = {
      id: `bible:${v.id}`,
      name: `${v.id}  ${displayName}`,
      subtitle: v.c,
      estimatedSize:
        v.id === 'BHG'
          ? BHG_INTERLINEAR_PUBLICATION.canonical.archiveBytes
          : isStrongVersion(v.id)
            ? 20_000_000
            : 2_500_000,
      lang: (v.type === 'en' ? 'en' : v.type === 'other' ? 'other' : 'fr') as 'fr' | 'en' | 'other',
      searchText: `${v.id} ${v.name} ${v.name_en || ''} ${v.c || ''}`.toLowerCase(),
    }
    if (v.id === 'BHG') {
      return [
        base,
        ...(['fr', 'en'] as ResourceLanguage[]).map(locale => {
          const artifact = BHG_INTERLINEAR_PUBLICATION.indexes[locale]
          return {
            id: `bible-interlinear:BHG:${locale}`,
            name: `${t('downloads.interlinearIndexName')} · ${t(
              `versionCatalog.language.${locale}`
            )}`,
            subtitle: t('downloads.interlinearAttribution'),
            parentItemId: base.id,
            estimatedSize: artifact.archiveBytes,
            lang: 'other' as const,
            searchText: `BHG STEP interlinear ${locale}`.toLowerCase(),
          }
        }),
      ]
    }
    if (!isStrongCapableBibleVersion(v.id)) return [base]
    const publication = getStrongBiblePublication(v.id)
    const strongIndexBibleName = getStrongIndexBibleName(displayName)
    return [
      base,
      {
        id: `bible-strong:${v.id}`,
        name: t('downloads.strongIndexName', { bible: strongIndexBibleName }),
        subtitle: t(getStrongBibleAttributionKey(v.id)),
        parentItemId: base.id,
        estimatedSize: publication.strong.archiveBytes,
        lang: v.type === 'en' ? 'en' : 'fr',
        searchText:
          `${v.id} ${v.name} ${strongIndexBibleName} strong index ${publication.datasetId}`.toLowerCase(),
      },
    ]
  })
}

function buildAllSections(
  appLang: string,
  t: (key: string, options?: Record<string, unknown>) => string
): UnifiedSection[] {
  const allVersions = Object.values(versions) as Version[]
  const bibleSections = buildBibleVersionGroups(allVersions, appLang).map(group => ({
    key: group.key,
    title: t(group.titleKey),
    data: buildBibleItems(group.versions, appLang, t),
  }))

  if (appLang === 'en') {
    return [
      {
        key: 'db-en',
        title: t('downloads.section.dbEn'),
        data: buildDatabaseItems('en'),
      },
      {
        key: 'db-shared',
        title: t('downloads.section.crossReferences'),
        data: buildSharedDatabaseItems(),
      },
      ...bibleSections,
      {
        key: 'db-fr',
        title: t('downloads.section.dbFr'),
        data: buildDatabaseItems('fr'),
      },
    ].filter(s => s.data.length > 0)
  }

  return [
    {
      key: 'db-fr',
      title: t('downloads.section.dbFr'),
      data: buildDatabaseItems('fr'),
    },
    {
      key: 'db-shared',
      title: t('downloads.section.crossReferences'),
      data: buildSharedDatabaseItems(),
    },
    ...bibleSections,
    {
      key: 'db-en',
      title: t('downloads.section.dbEn'),
      data: buildDatabaseItems('en'),
    },
  ].filter(s => s.data.length > 0)
}

// ---------------------------------------------------------------------------
// Hook: track downloaded state per item
// ---------------------------------------------------------------------------

function useDownloadedItems() {
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set())
  const [strongAvailability, setStrongAvailability] = useState<
    Map<StrongBibleVersionId, StrongBibleSidecarAvailability>
  >(new Map())
  const [interlinearAvailability, setInterlinearAvailability] = useState<
    Map<ResourceLanguage, InterlinearSidecarAvailability>
  >(new Map())
  const checkGeneration = React.useRef(0)
  const installedSignal = useAtomValue(installedVersionsSignalAtom)

  const checkAll = async () => {
    const generation = ++checkGeneration.current
    const set = new Set<string>()

    // Check all Bible versions
    for (const vId of Object.keys(versions)) {
      if (vId === 'LSGS' || vId === 'KJVS') continue
      const available = await isLocalResourceAvailable({ kind: 'bible', versionId: vId })
      if (available) set.add(`bible:${vId}`)
    }

    const availabilityMap = new Map<StrongBibleVersionId, StrongBibleSidecarAvailability>()
    for (const versionId of Object.keys(STRONG_BIBLE_PUBLICATIONS) as StrongBibleVersionId[]) {
      const availability = await getStrongBibleSidecarAvailability(versionId)
      availabilityMap.set(versionId, availability)
      if (
        availability.status === 'available' ||
        availability.status === 'incompatible' ||
        availability.status === 'corrupt'
      ) {
        set.add(`bible-strong:${versionId}`)
      }
    }

    const interlinearAvailabilityEntries = await Promise.all(
      (['fr', 'en'] as ResourceLanguage[]).map(async locale => {
        const availability = await getInterlinearSidecarAvailability(locale)
        return [locale, availability] as const
      })
    )
    const interlinearAvailabilityMap = new Map<ResourceLanguage, InterlinearSidecarAvailability>()
    for (const [locale, availability] of interlinearAvailabilityEntries) {
      interlinearAvailabilityMap.set(locale, availability)
      if (
        availability.status === 'available' ||
        availability.status === 'incompatible' ||
        availability.status === 'corrupt'
      ) {
        set.add(`bible-interlinear:BHG:${locale}`)
      }
    }

    // Check databases for both languages
    for (const lang of ['fr', 'en'] as ResourceLanguage[]) {
      const dbIds = LANGUAGE_SPECIFIC_DBS.filter(
        dbId => dbId !== 'INTERLINEAIRE' && dbId !== 'TIMELINE'
      ).filter(dbId => (lang === 'en' ? !FRENCH_ONLY_DBS.includes(dbId) : true))

      for (const dbId of dbIds) {
        const available = await isLocalResourceAvailable({
          kind: 'database',
          databaseId: dbId,
          lang,
        })
        if (available) set.add(`database:${dbId}:${lang}`)
      }
    }

    // Check shared databases
    for (const dbId of SHARED_DBS.filter(d => d !== 'BIBLES')) {
      const available = await isLocalResourceAvailable({
        kind: 'database',
        databaseId: dbId,
        lang: 'fr',
      })
      if (available) set.add(`database:${dbId}:fr`)
    }

    if (generation !== checkGeneration.current) return
    setDownloadedSet(set)
    setStrongAvailability(availabilityMap)
    setInterlinearAvailability(interlinearAvailabilityMap)
  }

  React.useEffect(() => {
    void checkAll()
  }, [installedSignal])

  return {
    downloadedSet,
    strongAvailability,
    interlinearAvailability,
    refreshDownloadedItems: checkAll,
  }
}

// ---------------------------------------------------------------------------
// Main screen component
// ---------------------------------------------------------------------------

const DownloadsScreen = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()
  const needsUpdateMap = useSelector((state: RootState) => state.user.needsUpdate)
  const defaultVersion = getDefaultBibleVersion(lang)
  const { enqueue, clearCompleted } = useDownloadQueue()

  // Local state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilter>>(new Set())
  const [langFilter, setLangFilter] = useState<Set<LangFilter>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())

  const { downloadedSet, strongAvailability, interlinearAvailability, refreshDownloadedItems } =
    useDownloadedItems()
  const allSections = buildAllSections(lang, t)

  // Initialize all sections as collapsed once we know them
  const allSectionKeys = allSections.map(s => s.key).join(',')
  React.useEffect(() => {
    setCollapsedSections(new Set(allSections.map(s => s.key)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSectionKeys])

  const toggleCollapse = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  // When searching or filtering, expand all sections so results are visible
  const hasActiveFilters = searchQuery.length > 0 || statusFilter.size > 0 || langFilter.size > 0

  // Filtering logic
  const filteredSections = allSections
    .map(section => ({
      ...section,
      data: section.data.filter(item => {
        // Search filter
        if (searchQuery && !item.searchText.includes(searchQuery.toLowerCase())) return false
        // Status filter (toggle like lang: none selected = show all)
        if (statusFilter.size > 0) {
          const isDownloaded = downloadedSet.has(item.id)
          if (statusFilter.has('downloaded') && !statusFilter.has('notDownloaded') && !isDownloaded)
            return false
          if (statusFilter.has('notDownloaded') && !statusFilter.has('downloaded') && isDownloaded)
            return false
        }
        // Language filter
        if (langFilter.size > 0 && !langFilter.has(item.lang)) return false
        return true
      }),
    }))
    .filter(section => section.data.length > 0)

  // Build display sections: collapse items when section is collapsed (and no active filters)
  const displaySections = filteredSections.map(section => ({
    ...section,
    data: !hasActiveFilters && collapsedSections.has(section.key) ? [] : section.data,
  }))

  // Actions
  const toggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const toggleSelectAll = (sectionData: UnifiedItem[]) => {
    const allIds = sectionData.map(i => i.id)
    const allSelected = allIds.every(id => selectedItems.has(id))

    setSelectedItems(prev => {
      const next = new Set(prev)
      if (allSelected) {
        allIds.forEach(id => next.delete(id))
      } else {
        allIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const refreshInstalledStateAfterDeletion = async () => {
    clearCompleted()
    await refreshDownloadedItems()
    getDefaultStore().set(installedVersionsSignalAtom, (c: number) => c + 1)
  }

  const handleBatchDownload = () => {
    const items = dedupeDownloadItems(
      Array.from(selectedItems)
        .filter(id => !downloadedSet.has(id))
        .flatMap(id => {
          if (id.startsWith('bible-strong:')) {
            const versionId = id.replace('bible-strong:', '') as StrongBibleVersionId
            return createStrongSidecarDownloadPlan(
              versionId,
              strongAvailability.get(versionId)?.status ?? 'base-missing'
            )
          }
          if (id.startsWith('bible-interlinear:')) {
            const locale = id.split(':')[2] as ResourceLanguage
            return createInterlinearSidecarDownloadPlan(
              locale,
              interlinearAvailability.get(locale)?.status ?? 'base-missing'
            )
          }
          if (id.startsWith('bible:')) {
            const versionId = id.replace('bible:', '')
            return [createBibleDownloadItem(versionId)]
          }
          const parts = id.split(':')
          return [createDatabaseDownloadItem(parts[1] as DatabaseId, parts[2] as ResourceLanguage)]
        })
    )

    if (items.length > 0) {
      enqueue(items)
      setIsSelectMode(false)
      setSelectedItems(new Set())
    }
  }

  const handleBatchDelete = () => {
    // Exclude default versions from batch delete
    const deletionPlans = Array.from(selectedItems)
      .filter(id => downloadedSet.has(id) && id !== `bible:${defaultVersion}`)
      .map(id => createDownloadedItemDeletionPlan(id))
    if (deletionPlans.length === 0) return

    const deletesStrongSidecar = deletionPlans.some(
      plan =>
        plan.kind === 'bible' &&
        plan.strongSidecar !== undefined &&
        downloadedSet.has(plan.strongSidecar.itemId)
    )
    const deletesInterlinearSidecar = deletionPlans.some(
      plan =>
        plan.kind === 'bible' &&
        plan.interlinearSidecars?.some(sidecar => downloadedSet.has(sidecar.itemId))
    )
    const confirmation = deletesInterlinearSidecar
      ? t('downloads.deleteCountWithInterlinear', { count: deletionPlans.length })
      : deletesStrongSidecar
        ? t('downloads.deleteCountWithStrong', { count: deletionPlans.length })
        : t('downloads.deleteCount', { count: deletionPlans.length })

    Alert.alert(t('Attention'), confirmation, [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          for (const plan of deletionPlans) {
            await deleteDownloadedItem(plan)
          }
          await refreshInstalledStateAfterDeletion()
          setIsSelectMode(false)
          setSelectedItems(new Set())
        },
      },
    ])
  }

  const handleDownloadItem = (item: UnifiedItem) => {
    if (item.id.startsWith('bible-strong:')) {
      const versionId = item.id.replace('bible-strong:', '') as StrongBibleVersionId
      const availability = strongAvailability.get(versionId)
      const items = createStrongSidecarDownloadPlan(
        versionId,
        availability?.status ?? 'base-missing'
      )
      enqueue(items)
      return
    }
    if (item.id.startsWith('bible-interlinear:')) {
      const locale = item.id.split(':')[2] as ResourceLanguage
      enqueue(
        createInterlinearSidecarDownloadPlan(
          locale,
          interlinearAvailability.get(locale)?.status ?? 'base-missing'
        )
      )
      return
    }
    if (item.id.startsWith('bible:')) {
      const versionId = item.id.replace('bible:', '')
      enqueue([createBibleDownloadItem(versionId)])
    } else {
      const parts = item.id.split(':')
      enqueue([createDatabaseDownloadItem(parts[1] as DatabaseId, parts[2] as ResourceLanguage)])
    }
  }

  const handleRedownloadItem = (item: UnifiedItem) => {
    const deletionPlan = createDownloadedItemDeletionPlan(item.id, { bibleMode: 'replace' })
    Alert.alert(t('Attention'), t('downloads.redownloadConfirm'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        onPress: async () => {
          await deleteDownloadedItem(deletionPlan)
          await refreshInstalledStateAfterDeletion()
          handleDownloadItem(item)
        },
      },
    ])
  }

  const handleUpdateItem = (item: UnifiedItem) => {
    const isRequiredBible = item.id === `bible:${defaultVersion}`
    const deletionPlan = createDownloadedItemDeletionPlan(item.id, {
      bibleMode: isRequiredBible ? 'replace' : 'remove',
    })
    const deletesStrongSidecar =
      deletionPlan.kind === 'bible' &&
      deletionPlan.strongSidecar !== undefined &&
      downloadedSet.has(deletionPlan.strongSidecar.itemId)
    const deletesInterlinearSidecar =
      deletionPlan.kind === 'bible' &&
      deletionPlan.interlinearSidecars?.some(sidecar => downloadedSet.has(sidecar.itemId))
    const confirmation = deletesInterlinearSidecar
      ? t('downloads.updateBibleWithInterlinearConfirm')
      : deletesStrongSidecar
        ? t('downloads.updateBibleWithStrongConfirm')
        : t('downloads.updateConfirm')

    Alert.alert(t('downloads.updateAvailable'), confirmation, [
      { text: t('downloads.later'), style: 'cancel' },
      {
        text: t('downloads.update'),
        onPress: async () => {
          await deleteDownloadedItem(deletionPlan)
          await refreshInstalledStateAfterDeletion()
          handleDownloadItem(item)
        },
      },
    ])
  }

  const handleDeleteItem = (item: UnifiedItem) => {
    const deletionPlan = createDownloadedItemDeletionPlan(item.id)
    const deletesStrongSidecar =
      deletionPlan.kind === 'bible' &&
      deletionPlan.strongSidecar !== undefined &&
      downloadedSet.has(deletionPlan.strongSidecar.itemId)
    const deletesInterlinearSidecar =
      deletionPlan.kind === 'bible' &&
      deletionPlan.interlinearSidecars?.some(sidecar => downloadedSet.has(sidecar.itemId))
    const confirmation = deletesInterlinearSidecar
      ? t('downloads.deleteBibleWithInterlinearConfirm')
      : deletesStrongSidecar
        ? t('downloads.deleteBibleWithStrongConfirm')
        : t('downloads.deleteConfirm')

    Alert.alert(t('Attention'), confirmation, [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          await deleteDownloadedItem(deletionPlan)
          await refreshInstalledStateAfterDeletion()
        },
      },
    ])
  }

  const handleStatusToggle = (s: StatusFilter) => {
    setStatusFilter(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const handleLangToggle = (l: LangFilter) => {
    setLangFilter(prev => {
      const next = new Set(prev)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return next
    })
  }

  // Count downloadable/deletable in selection
  const selectedDownloadable = Array.from(selectedItems).filter(id => !downloadedSet.has(id)).length
  const selectedDeletable = Array.from(selectedItems).filter(id => downloadedSet.has(id)).length

  return (
    <Container>
      <Header
        hasBackButton
        title={t('downloads.title')}
        rightComponent={
          <TouchableOpacity
            onPress={() => {
              setIsSelectMode(prev => !prev)
              if (isSelectMode) setSelectedItems(new Set())
            }}
            style={{ paddingHorizontal: 16, padding: 8 }}
          >
            <FeatherIcon
              name={isSelectMode ? 'check' : 'check-square'}
              size={20}
              color={isSelectMode ? 'success' : 'primary'}
            />
          </TouchableOpacity>
        }
      />

      <SectionList<UnifiedItem, UnifiedSection>
        sections={displaySections}
        keyExtractor={(item: UnifiedItem) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Search */}
            <Box
              mx={16}
              mt={12}
              row
              alignItems="center"
              bg="border"
              borderRadius={10}
              px={12}
              height={40}
            >
              <FeatherIcon name="search" size={16} color="tertiary" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('downloads.search')}
                placeholderTextColor={theme.colors.tertiary}
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 14,
                  color: theme.colors.default,
                  padding: 0,
                }}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <FeatherIcon name="x" size={16} color="tertiary" />
                </TouchableOpacity>
              )}
            </Box>

            {/* Filters */}
            <FilterChipRow
              statusFilter={statusFilter}
              langFilter={langFilter}
              onStatusToggle={handleStatusToggle}
              onLangToggle={handleLangToggle}
            />

            <StorageSummaryCard />
          </>
        }
        renderSectionHeader={({ section }) => {
          // Use the full (non-collapsed) data from filteredSections for counts
          const fullSection = filteredSections.find(s => s.key === section.key)
          const sectionItems = fullSection?.data || []
          const downloadedCount = sectionItems.filter(i => downloadedSet.has(i.id)).length
          const totalCount = sectionItems.length
          const isCollapsed = !hasActiveFilters && collapsedSections.has(section.key)

          return (
            <DownloadSectionHeader
              title={section.title}
              isCollapsed={isCollapsed}
              onToggleCollapse={() => toggleCollapse(section.key)}
              downloadedCount={downloadedCount}
              totalCount={totalCount}
              isSelectMode={isSelectMode}
              allSelected={sectionItems.every((i: UnifiedItem) => selectedItems.has(i.id))}
              onToggleSelectAll={() => toggleSelectAll(sectionItems)}
            />
          )
        }}
        renderItem={({ item, index, section }) => {
          const isDownloaded = downloadedSet.has(item.id)
          // Extract the raw database or version id for needsUpdate check
          let needsUpdateKey: string | undefined
          if (item.id.startsWith('bible:')) {
            needsUpdateKey = item.id.replace('bible:', '')
          } else if (item.id.startsWith('database:')) {
            needsUpdateKey = item.id.split(':')[1]
          }

          const isDefault = item.id === `bible:${defaultVersion}`
          const isNestedDependency =
            item.parentItemId !== undefined && section.data[index - 1]?.id === item.parentItemId

          return (
            <DownloadableItem
              itemId={item.id}
              name={item.name}
              subtitle={item.subtitle}
              estimatedSize={item.estimatedSize}
              isSelectMode={isSelectMode}
              isSelected={selectedItems.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onDownload={() => handleDownloadItem(item)}
              onDelete={isDefault ? undefined : () => handleDeleteItem(item)}
              onRedownload={isDefault ? () => handleRedownloadItem(item) : undefined}
              onUpdate={() => handleUpdateItem(item)}
              isDownloaded={isDownloaded}
              isDefault={isDefault}
              needsUpdate={needsUpdateKey ? needsUpdateMap[needsUpdateKey] : false}
              variant={isNestedDependency ? 'dependency' : 'standard'}
            />
          )
        }}
      />

      {/* Bottom bars */}
      {isSelectMode ? (
        <BatchActionBar
          selectedCount={selectedItems.size}
          hasDownloadable={selectedDownloadable > 0}
          hasDeletable={selectedDeletable > 0}
          onDownload={handleBatchDownload}
          onDelete={handleBatchDelete}
        />
      ) : (
        <GlobalDownloadBar />
      )}
    </Container>
  )
}

export default DownloadsScreen
