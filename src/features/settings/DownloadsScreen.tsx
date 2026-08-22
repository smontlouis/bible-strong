import React, { useEffect, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Alert, TextInput, TouchableOpacity } from 'react-native'
import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai/react'

import Header from '~common/Header'
import Loading from '~common/Loading'
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

import { versions, type Version } from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  FRENCH_ONLY_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from '~helpers/databaseTypes'
import {
  getLocalResourceAvailability,
  isLocalResourceAvailable,
} from '~features/resources/resourceAvailability'
import {
  createOfflineCopyDownloadItem,
  createOfflineCopyDownloadPlan,
  dedupeDownloadItems,
} from '~helpers/downloadItemFactory'
import { createOfflineCopyId, parseOfflineCopyId } from '~helpers/offlineCopy'
import { useDownloadQueue } from '~helpers/useDownloadQueue'
import { installedVersionsSignalAtom } from '~state/app'
import { mobileResourceCatalogAtom } from '~helpers/mobileResourceCatalog'
import useLanguage from '~helpers/useLanguage'
import { getDefaultStore } from 'jotai/vanilla'
import {
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
import { buildBibleVersionGroups } from './downloadVersionGroups'
import {
  getInterlinearSidecarAvailability,
  type InterlinearSidecarAvailability,
} from '~helpers/interlinearBibleSidecar'
import { getBibleRelatedPublicationResources } from '~helpers/bibleRelatedPublications'
import {
  getStrongLexiconModuleAvailability,
  type StrongLexiconModuleAvailability,
} from '~helpers/strongLexiconModules'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import { resolveResourceCatalogStatus } from '~helpers/resourcePublication'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceIdentityFromOfflineCopy } from '~features/resources/resourceModel'
import useConnection from '~helpers/useConnection'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { buildBibleItems, type UnifiedDownloadItem } from './downloadBibleItems'

// ---------------------------------------------------------------------------
// Unified section item type
// ---------------------------------------------------------------------------

type UnifiedItem = UnifiedDownloadItem

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
  return LANGUAGE_SPECIFIC_DBS.flatMap(dbId => {
    if (dbId === 'BIBLES' || (lang === 'en' && FRENCH_ONLY_DBS.includes(dbId))) {
      return []
    }
    const db = allDbs[dbId as keyof typeof allDbs]
    return db
      ? [
          {
            id: createOfflineCopyId({ kind: 'database', databaseId: dbId, language: lang }),
            name: db.name,
            subtitle: db.desc,
            estimatedSize: db.fileSize,
            lang: lang as 'fr' | 'en',
            searchText: `${db.name} ${db.desc} ${dbId}`.toLowerCase(),
          },
        ]
      : []
  })
}

function buildStrongLexiconItems(
  t: (key: string, options?: Record<string, unknown>) => string
): UnifiedItem[] {
  return [
    {
      id: createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' }),
      name: t('offlineSetup.resources.strongLexicon'),
      subtitle: t('offlineSetup.option.strongLexiconDescription'),
      estimatedSize: createOfflineCopyDownloadItem({
        kind: 'strong-lexicon-module',
        moduleId: 'core',
      }).estimatedSize,
      lang: 'other',
      searchText: 'strong lexique grec hébreu core step morphology'.toLowerCase(),
    },
    {
      id: createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'resources' }),
      name: t('offlineSetup.resources.greekDictionary'),
      subtitle: t('offlineSetup.option.greekDictionaryDescription'),
      parentItemId: createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' }),
      estimatedSize: createOfflineCopyDownloadItem({
        kind: 'strong-lexicon-module',
        moduleId: 'resources',
      }).estimatedSize,
      lang: 'other',
      searchText: 'strong grec lsj tflsj ressources'.toLowerCase(),
    },
    {
      id: createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'entities' }),
      name: t('offlineSetup.resources.entities'),
      subtitle: t('offlineSetup.option.entitiesDescription'),
      parentItemId: createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' }),
      estimatedSize: createOfflineCopyDownloadItem({
        kind: 'strong-lexicon-module',
        moduleId: 'entities',
      }).estimatedSize,
      lang: 'other',
      searchText: 'strong entités bibliques personnes lieux groupes'.toLowerCase(),
    },
  ]
}

function buildSharedDatabaseItems(): UnifiedItem[] {
  const allDbs = databases('fr')
  return SHARED_DBS.filter(
    (dbId): dbId is Exclude<DatabaseId, 'BIBLES'> => dbId !== 'BIBLES' && dbId in allDbs
  ).map(dbId => {
    const db = allDbs[dbId as keyof typeof allDbs]
    return {
      id: createOfflineCopyId({ kind: 'database', databaseId: dbId, language: 'fr' }),
      name: db.name,
      subtitle: db.desc,
      estimatedSize: db.fileSize,
      lang: 'fr' as const,
      searchText: `${db.name} ${db.desc} ${dbId}`.toLowerCase(),
    }
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
        key: 'strong-lexicon',
        title: t('downloads.section.strongLexicon'),
        data: buildStrongLexiconItems(t),
      },
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
      key: 'strong-lexicon',
      title: t('downloads.section.strongLexicon'),
      data: buildStrongLexiconItems(t),
    },
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
  const installedSignal = useAtomValue(installedVersionsSignalAtom)
  const previousInstalledSignal = useRef(installedSignal)
  const availabilityQuery = useQuery({
    queryKey: ['downloads', 'installed-resources'],
    networkMode: 'always',
    queryFn: async () => {
      const set = new Set<string>()
      const invalidSet = new Set<string>()

      const lexiconAvailabilityMap = new Map<
        StrongLexiconModuleId,
        StrongLexiconModuleAvailability
      >()
      const lexiconEntries = await Promise.all(
        (['core', 'resources', 'entities'] as StrongLexiconModuleId[]).map(async moduleId => {
          const availability = await getStrongLexiconModuleAvailability(moduleId)
          return [moduleId, availability] as const
        })
      )
      for (const [moduleId, availability] of lexiconEntries) {
        lexiconAvailabilityMap.set(moduleId, availability)
        if (
          availability.status === 'available' ||
          availability.status === 'incompatible' ||
          availability.status === 'corrupt' ||
          availability.status === 'core-missing'
        ) {
          set.add(
            createOfflineCopyId({
              kind: 'strong-lexicon-module',
              moduleId,
            })
          )
        }
        if (availability.status === 'corrupt') {
          invalidSet.add(createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId }))
        }
      }

      // Check all Bible versions
      const bibleEntries = await Promise.all(
        Object.keys(versions).map(async versionId => {
          const available = await isLocalResourceAvailable({
            kind: 'bible',
            versionId,
          })
          return [versionId, available] as const
        })
      )
      for (const [vId, available] of bibleEntries) {
        if (available) set.add(createOfflineCopyId({ kind: 'bible', versionId: vId }))
      }

      const availabilityMap = new Map<StrongBibleVersionId, StrongBibleSidecarAvailability>()
      const strongEntries = await Promise.all(
        (Object.keys(STRONG_BIBLE_PUBLICATIONS) as StrongBibleVersionId[]).map(
          async versionId =>
            [versionId, await getStrongBibleSidecarAvailability(versionId)] as const
        )
      )
      for (const [versionId, availability] of strongEntries) {
        availabilityMap.set(versionId, availability)
        if (
          availability.status === 'available' ||
          availability.status === 'incompatible' ||
          availability.status === 'corrupt'
        ) {
          set.add(createOfflineCopyId({ kind: 'strong-bible-index', versionId }))
        }
        if (availability.status === 'corrupt') {
          invalidSet.add(createOfflineCopyId({ kind: 'strong-bible-index', versionId }))
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
          set.add(
            createOfflineCopyId({
              kind: 'interlinear-index',
              versionId: 'BHG',
              language: locale,
            })
          )
        }
        if (availability.status === 'corrupt') {
          invalidSet.add(
            createOfflineCopyId({
              kind: 'interlinear-index',
              versionId: 'BHG',
              language: locale,
            })
          )
        }
      }

      // Check databases for both languages
      const databaseEntries = await Promise.all(
        (['fr', 'en'] as ResourceLanguage[]).flatMap(lang =>
          LANGUAGE_SPECIFIC_DBS.flatMap(dbId =>
            dbId !== 'BIBLES' && (lang !== 'en' || !FRENCH_ONLY_DBS.includes(dbId))
              ? [
                  getLocalResourceAvailability({
                    kind: 'database',
                    databaseId: dbId,
                    language: lang,
                  }).then(availability => [dbId, lang, availability] as const),
                ]
              : []
          )
        )
      )
      for (const [dbId, lang, availability] of databaseEntries) {
        const itemId = createOfflineCopyId({
          kind: 'database',
          databaseId: dbId,
          language: lang,
        })
        if (availability.status === 'available' || availability.status === 'corrupt') {
          set.add(itemId)
        }
        if (availability.status === 'corrupt') {
          invalidSet.add(itemId)
        }
      }

      // Check shared databases
      const sharedEntries = await Promise.all(
        SHARED_DBS.flatMap(dbId =>
          dbId === 'BIBLES'
            ? []
            : [
                getLocalResourceAvailability({
                  kind: 'database',
                  databaseId: dbId,
                  language: 'fr',
                }).then(availability => [dbId, availability] as const),
              ]
        )
      )
      for (const [dbId, availability] of sharedEntries) {
        const itemId = createOfflineCopyId({
          kind: 'database',
          databaseId: dbId,
          language: 'fr',
        })
        if (availability.status === 'available' || availability.status === 'corrupt') {
          set.add(itemId)
        }
        if (availability.status === 'corrupt') {
          invalidSet.add(itemId)
        }
      }

      return {
        downloadedSet: set,
        invalidSet,
        strongAvailability: availabilityMap,
        interlinearAvailability: interlinearAvailabilityMap,
        strongLexiconAvailability: lexiconAvailabilityMap,
      }
    },
  })
  const refetchAvailability = availabilityQuery.refetch

  useEffect(() => {
    if (previousInstalledSignal.current === installedSignal) return
    previousInstalledSignal.current = installedSignal
    void refetchAvailability()
  }, [installedSignal, refetchAvailability])

  return {
    downloadedSet: availabilityQuery.data?.downloadedSet ?? new Set<string>(),
    invalidSet: availabilityQuery.data?.invalidSet ?? new Set<string>(),
    strongAvailability:
      availabilityQuery.data?.strongAvailability ??
      new Map<StrongBibleVersionId, StrongBibleSidecarAvailability>(),
    interlinearAvailability:
      availabilityQuery.data?.interlinearAvailability ??
      new Map<ResourceLanguage, InterlinearSidecarAvailability>(),
    strongLexiconAvailability:
      availabilityQuery.data?.strongLexiconAvailability ??
      new Map<StrongLexiconModuleId, StrongLexiconModuleAvailability>(),
    isAvailabilityPending: availabilityQuery.isPending,
    isAvailabilityError: availabilityQuery.isError,
    refreshDownloadedItems: async () => {
      await availabilityQuery.refetch()
    },
  }
}

// ---------------------------------------------------------------------------
// Main screen component
// ---------------------------------------------------------------------------

const DownloadsScreen = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const lang = useLanguage()
  const catalog = useAtomValue(mobileResourceCatalogAtom)
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const { enqueue, clearCompleted } = useDownloadQueue()

  // Local state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [batchDeletionProgress, setBatchDeletionProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilter>>(new Set())
  const [langFilter, setLangFilter] = useState<Set<LangFilter>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())

  const {
    downloadedSet,
    invalidSet,
    strongAvailability,
    interlinearAvailability,
    strongLexiconAvailability,
    isAvailabilityPending,
    isAvailabilityError,
    refreshDownloadedItems,
  } = useDownloadedItems()
  const allSections = buildAllSections(lang, t)
  const publicationResources = allSections.flatMap(section =>
    section.data.flatMap(item => {
      if (!downloadedSet.has(item.id)) return []
      const identity = parseOfflineCopyId(item.id)
      if (!identity) return []
      const relatedResources =
        identity.kind === 'bible'
          ? (getBibleRelatedPublicationResources(identity.versionId) ?? [])
          : []

      return [
        { itemId: item.id, resourceId: item.id },
        ...relatedResources.map(resource => ({ itemId: item.id, ...resource })),
      ]
    })
  )
  const publicationQueries = useQueries({
    queries: publicationResources.map(resource => ({
      queryKey: [
        'resource-publication',
        resource.resourceId,
        catalog.resources[resource.resourceId]?.archiveSha256,
      ],
      queryFn: () => resolveResourceCatalogStatus(resource.resourceId, { catalog }),
      // Canonical Bible bundles can register bundled presentation copies (pericopes/red words)
      // that intentionally have no standalone catalog publication.
      enabled: Boolean(catalog.resources[resource.resourceId]),
      staleTime: 6 * 60 * 60 * 1000,
      refetchOnMount: 'always' as const,
      retry: false,
    })),
  })
  const publicationUpdateIds = new Set(
    publicationResources.flatMap((resource, index) => {
      return publicationQueries[index]?.data === 'update-available' ? [resource.itemId] : []
    })
  )

  const itemNeedsUpdate = (item: UnifiedItem) => {
    if (publicationUpdateIds.has(item.id)) return true
    const identity = parseOfflineCopyId(item.id)
    if (!identity) return false

    if (identity.kind === 'strong-bible-index') {
      return ['incompatible'].includes(strongAvailability.get(identity.versionId)?.status ?? '')
    }
    if (identity.kind === 'strong-lexicon-module') {
      return ['incompatible', 'core-missing'].includes(
        strongLexiconAvailability.get(identity.moduleId)?.status ?? ''
      )
    }
    if (identity.kind === 'interlinear-index') {
      return ['base-incompatible'].includes(
        interlinearAvailability.get(identity.language)?.status ?? ''
      )
    }
    return false
  }

  const itemsToUpdate = allSections.flatMap(section => section.data).filter(itemNeedsUpdate)

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
    if (batchDeletionProgress) return
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const toggleSelectAll = (sectionData: UnifiedItem[]) => {
    if (batchDeletionProgress) return
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

  const createDownloadPlanForId = (itemId: string) => {
    const identity = parseOfflineCopyId(itemId)
    if (!identity) throw new Error(`UNKNOWN_OFFLINE_COPY:${itemId}`)

    switch (identity.kind) {
      case 'strong-bible-index':
        return createOfflineCopyDownloadPlan(identity, {
          availabilityStatus: strongAvailability.get(identity.versionId)?.status ?? 'base-missing',
        })
      case 'interlinear-index':
        return createOfflineCopyDownloadPlan(identity, {
          availabilityStatus:
            interlinearAvailability.get(identity.language)?.status ?? 'base-missing',
        })
      case 'strong-lexicon-module':
        return createOfflineCopyDownloadPlan(identity, {
          isStrongLexiconCoreAvailable:
            strongLexiconAvailability.get('core')?.status === 'available',
        })
      case 'bible':
      case 'database':
        return createOfflineCopyDownloadPlan(identity)
      case 'bible-pericope':
      case 'bible-red-words':
        throw new Error(`BIBLE_CHILD_RESOURCE_IS_NOT_MANAGED_SEPARATELY:${itemId}`)
    }
  }

  const handleBatchDownload = () => {
    if (!isConnected) return
    const items = dedupeDownloadItems(
      Array.from(selectedItems).flatMap(id =>
        downloadedSet.has(id) ? [] : createDownloadPlanForId(id)
      )
    )

    if (items.length > 0) {
      enqueue(items)
      setIsSelectMode(false)
      setSelectedItems(new Set())
    }
  }

  const handleBatchDelete = () => {
    const deletionEntries = Array.from(selectedItems).flatMap(itemId =>
      downloadedSet.has(itemId) ? [{ itemId, plan: createDownloadedItemDeletionPlan(itemId) }] : []
    )
    if (deletionEntries.length === 0) return

    const deletesStrongSidecar = deletionEntries.some(
      ({ plan }) =>
        plan.kind === 'bible' &&
        plan.strongSidecar !== undefined &&
        downloadedSet.has(plan.strongSidecar.itemId)
    )
    const deletesInterlinearSidecar = deletionEntries.some(
      ({ plan }) =>
        plan.kind === 'bible' &&
        plan.interlinearSidecars?.some(sidecar => downloadedSet.has(sidecar.itemId))
    )
    const confirmation = deletesInterlinearSidecar
      ? t('downloads.deleteCountWithInterlinear', { count: deletionEntries.length })
      : deletesStrongSidecar
        ? t('downloads.deleteCountWithStrong', { count: deletionEntries.length })
        : t('downloads.deleteCount', { count: deletionEntries.length })

    Alert.alert(t('Attention'), confirmation, [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          const deletedItemIds: string[] = []
          setBatchDeletionProgress({ completed: 0, total: deletionEntries.length })

          try {
            for (const { itemId, plan } of deletionEntries) {
              await deleteDownloadedItem(plan)
              deletedItemIds.push(itemId)
              setBatchDeletionProgress({
                completed: deletedItemIds.length,
                total: deletionEntries.length,
              })
            }
            await refreshInstalledStateAfterDeletion()
            setIsSelectMode(false)
            setSelectedItems(new Set())
          } catch {
            await refreshInstalledStateAfterDeletion().catch(() => undefined)
            setSelectedItems(previous => {
              const remaining = new Set(previous)
              deletedItemIds.forEach(itemId => remaining.delete(itemId))
              return remaining
            })
            Alert.alert(t('Erreur'), t('downloads.deleteFailed'))
          } finally {
            setBatchDeletionProgress(null)
          }
        },
      },
    ])
  }

  const handleDownloadItem = (item: UnifiedItem) => {
    if (!isConnected) return
    enqueue(createDownloadPlanForId(item.id))
  }

  const handleRedownloadItem = (item: UnifiedItem) => {
    if (!isConnected) return
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
    if (!isConnected) return
    const deletionPlan = createDownloadedItemDeletionPlan(item.id, { bibleMode: 'replace' })
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
        onPress: () => handleDownloadItem(item),
      },
    ])
  }

  const handleUpdateAll = () => {
    if (!isConnected) return
    Alert.alert(
      t('downloads.updateAvailable'),
      t(
        itemsToUpdate.length === 1
          ? 'downloads.updateCountConfirm_one'
          : 'downloads.updateCountConfirm_other',
        { count: itemsToUpdate.length }
      ),
      [
        { text: t('downloads.later'), style: 'cancel' },
        {
          text: t('downloads.update'),
          onPress: () =>
            enqueue(
              dedupeDownloadItems(itemsToUpdate.flatMap(item => createDownloadPlanForId(item.id)))
            ),
        },
      ]
    )
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
          <Box row alignItems="center">
            {itemsToUpdate.length > 0 && !isSelectMode && (
              <TouchableOpacity
                accessibilityState={{ disabled: !isConnected }}
                disabled={!isConnected}
                onPress={handleUpdateAll}
                accessibilityLabel={t('downloads.update')}
                style={{ padding: 8 }}
              >
                <FeatherIcon
                  name={isConnected ? 'refresh-cw' : 'wifi-off'}
                  size={20}
                  color={isConnected ? 'success' : 'tertiary'}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityState={{ disabled: batchDeletionProgress !== null }}
              disabled={batchDeletionProgress !== null}
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
          </Box>
        }
      />

      {isAvailabilityPending ? (
        <Box flex center>
          <Loading />
        </Box>
      ) : isAvailabilityError ? (
        <ResourceUnavailableView
          title={t('downloads.availabilityUnavailable')}
          failure={{ cause: 'temporary-unavailable', recoveries: ['retry'] }}
          onRetry={() => void refreshDownloadedItems()}
        />
      ) : (
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
          renderItem={({ item }) => {
            const isDownloaded = downloadedSet.has(item.id)
            const identity = parseOfflineCopyId(item.id)
            if (!identity) return null
            const isNestedDependency = item.parentItemId !== undefined
            const bibleVersionId = identity.kind === 'bible' ? identity.versionId : undefined
            const resourceIdentity = resourceIdentityFromOfflineCopy(identity)
            const relatedResources = bibleVersionId
              ? getBibleRelatedPublicationResources(bibleVersionId)
              : undefined

            return (
              <DownloadableItem
                itemId={item.id}
                relatedResources={relatedResources}
                name={item.name}
                subtitle={item.subtitle}
                estimatedSize={item.estimatedSize}
                isSelectMode={isSelectMode}
                isSelected={selectedItems.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
                onDownload={() => handleDownloadItem(item)}
                onDelete={() => handleDeleteItem(item)}
                onRedownload={() => handleRedownloadItem(item)}
                onUpdate={() => handleUpdateItem(item)}
                isDownloaded={isDownloaded}
                isDefault={false}
                needsUpdate={itemNeedsUpdate(item)}
                isInvalid={invalidSet.has(item.id)}
                variant={isNestedDependency ? 'dependency' : 'standard'}
                onlineAccessStatus={
                  resourceIdentity
                    ? resources.capabilities.getOnlineAccess(resourceIdentity).status
                    : 'unsupported'
                }
                downloadsDisabled={!isConnected}
              />
            )
          }}
        />
      )}

      {/* Bottom bars */}
      {!isAvailabilityPending &&
        !isAvailabilityError &&
        (isSelectMode ? (
          <BatchActionBar
            selectedCount={selectedItems.size}
            hasDownloadable={selectedDownloadable > 0}
            hasDeletable={selectedDeletable > 0}
            onDownload={handleBatchDownload}
            onDelete={handleBatchDelete}
            downloadsDisabled={!isConnected}
            deletionProgress={batchDeletionProgress}
          />
        ) : (
          <GlobalDownloadBar />
        ))}
    </Container>
  )
}

export default DownloadsScreen
