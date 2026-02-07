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
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'

import DownloadableItem from './components/DownloadableItem'
import StorageSummaryCard from './components/StorageSummaryCard'
import FilterChipRow, { type StatusFilter, type LangFilter } from './components/FilterChipRow'
import DownloadSectionHeader from './components/DownloadSectionHeader'
import GlobalDownloadBar from './components/GlobalDownloadBar'
import BatchActionBar from './components/BatchActionBar'

import {
  versions,
  getIfVersionNeedsDownload,
  isStrongVersion,
  type Version,
} from '~helpers/bibleVersions'
import { databases } from '~helpers/databases'
import { getIfDatabaseNeedsDownloadForLang, getIfDatabaseNeedsDownload } from '~helpers/databases'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  FRENCH_ONLY_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from '~helpers/databaseTypes'
import { createBibleDownloadItem, createDatabaseDownloadItem } from '~helpers/downloadItemFactory'
import { useDownloadQueue } from '~helpers/useDownloadQueue'
import { isVersionInstalled, removeBibleVersion } from '~helpers/biblesDb'
import { installedVersionsSignalAtom } from '~state/app'
import useLanguage from '~helpers/useLanguage'
import { RootState } from '~redux/modules/reducer'
import { getDefaultStore } from 'jotai/vanilla'
import { requireBiblePath } from '~helpers/requireBiblePath'
import * as FileSystem from 'expo-file-system/legacy'
import { dbManager } from '~helpers/sqlite'
import { deleteRedWordsFile } from '~helpers/redWords'
import { deletePericopeFile } from '~helpers/pericopes'
import { toast } from '~helpers/toast'
import { getDefaultBibleVersion } from '~helpers/languageUtils'

// ---------------------------------------------------------------------------
// Unified section item type
// ---------------------------------------------------------------------------

interface UnifiedItem {
  id: string // itemId for DownloadableItem, e.g. "bible:LSG" or "database:STRONG:fr"
  name: string
  subtitle?: string
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

function buildBibleItems(versionList: Version[], appLang: string): UnifiedItem[] {
  return versionList
    .filter(v => v.id !== 'LSGS' && v.id !== 'KJVS') // Strong versions hidden in downloads
    .map(v => {
      const displayName = appLang === 'en' && v.name_en ? v.name_en : v.name
      return {
        id: `bible:${v.id}`,
        name: `${v.id}  ${displayName}`,
        subtitle: v.c,
        estimatedSize: isStrongVersion(v.id) ? 20_000_000 : 2_500_000,
        lang: (v.type === 'en' ? 'en' : v.type === 'other' ? 'other' : 'fr') as
          | 'fr'
          | 'en'
          | 'other',
        searchText: `${v.id} ${v.name} ${v.name_en || ''} ${v.c || ''}`.toLowerCase(),
      }
    })
}

function buildAllSections(appLang: string, t: (key: string) => string): UnifiedSection[] {
  const allVersions = Object.values(versions) as Version[]

  // Segond + French interlinear
  const segondVersions = allVersions.filter(v =>
    ['LSG', 'NBS', 'NEG79', 'NVS78P', 'S21', 'INT'].includes(v.id)
  )
  const otherFrenchVersions = allVersions.filter(
    v => v.type === 'fr' && !['LSG', 'LSGS', 'NBS', 'NEG79', 'NVS78P', 'S21', 'INT'].includes(v.id)
  )
  // English + English interlinear
  const englishVersions = allVersions.filter(
    v => (v.type === 'en' && v.id !== 'KJVS') || v.id === 'INT_EN'
  )
  // All French bibles for English mode (single section)
  const allFrenchVersions = allVersions.filter(v => v.type === 'fr' && v.id !== 'LSGS')
  const otherVersions = allVersions.filter(v => v.type === 'other')

  if (appLang === 'en') {
    // English mode: same structure as French but English content first
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
      {
        key: 'bible-en',
        title: t('downloads.section.bibleEn'),
        data: buildBibleItems(englishVersions, appLang),
      },
      {
        key: 'bible-fr',
        title: t('downloads.section.bibleFr'),
        data: buildBibleItems(allFrenchVersions, appLang),
      },
      {
        key: 'db-fr',
        title: t('downloads.section.dbFr'),
        data: buildDatabaseItems('fr'),
      },
      {
        key: 'bible-other',
        title: t('downloads.section.bibleOther'),
        data: buildBibleItems(otherVersions, appLang),
      },
    ].filter(s => s.data.length > 0)
  }

  // French mode
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
    {
      key: 'bible-segond',
      title: t('downloads.section.bibleSegond'),
      data: buildBibleItems(segondVersions, appLang),
    },
    {
      key: 'bible-fr-other',
      title: t('downloads.section.bibleFrOther'),
      data: buildBibleItems(otherFrenchVersions, appLang),
    },
    {
      key: 'bible-en',
      title: t('downloads.section.bibleEn'),
      data: buildBibleItems(englishVersions, appLang),
    },
    {
      key: 'db-en',
      title: t('downloads.section.dbEn'),
      data: buildDatabaseItems('en'),
    },
    {
      key: 'bible-other',
      title: t('downloads.section.bibleOther'),
      data: buildBibleItems(otherVersions, appLang),
    },
  ].filter(s => s.data.length > 0)
}

// ---------------------------------------------------------------------------
// Hook: track downloaded state per item
// ---------------------------------------------------------------------------

function useDownloadedItems() {
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set())
  const installedSignal = useAtomValue(installedVersionsSignalAtom)

  React.useEffect(() => {
    checkAll()
  }, [installedSignal])

  const checkAll = async () => {
    const set = new Set<string>()

    // Check all Bible versions
    for (const vId of Object.keys(versions)) {
      if (vId === 'LSGS' || vId === 'KJVS') continue
      const needs = await getIfVersionNeedsDownload(vId)
      if (!needs) set.add(`bible:${vId}`)
    }

    // Check databases for both languages
    for (const lang of ['fr', 'en'] as ResourceLanguage[]) {
      const dbIds = LANGUAGE_SPECIFIC_DBS.filter(
        dbId => dbId !== 'INTERLINEAIRE' && dbId !== 'TIMELINE'
      ).filter(dbId => (lang === 'en' ? !FRENCH_ONLY_DBS.includes(dbId) : true))

      for (const dbId of dbIds) {
        const needs = await getIfDatabaseNeedsDownloadForLang(dbId as any, lang)
        if (!needs) set.add(`database:${dbId}:${lang}`)
      }
    }

    // Check shared databases
    for (const dbId of SHARED_DBS.filter(d => d !== 'BIBLES')) {
      const needs = await getIfDatabaseNeedsDownload(dbId as any)
      if (!needs) set.add(`database:${dbId}:fr`)
    }

    setDownloadedSet(set)
  }

  return downloadedSet
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
  const { activeQueue, enqueue, cancelAll } = useDownloadQueue()

  // Local state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilter>>(new Set())
  const [langFilter, setLangFilter] = useState<Set<LangFilter>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set())

  const downloadedSet = useDownloadedItems()
  const allSections = buildAllSections(lang, t)

  // Initialize all sections as collapsed once we know them
  const allSectionKeys = allSections.map(s => s.key).join(',')
  React.useEffect(() => {
    setCollapsedSections(new Set(allSections.map(s => s.key)))
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

  const handleBatchDownload = () => {
    const items = Array.from(selectedItems)
      .filter(id => !downloadedSet.has(id))
      .map(id => {
        if (id.startsWith('bible:')) {
          const versionId = id.replace('bible:', '')
          return createBibleDownloadItem(versionId)
        }
        const parts = id.split(':')
        return createDatabaseDownloadItem(parts[1] as DatabaseId, parts[2] as ResourceLanguage)
      })

    if (items.length > 0) {
      enqueue(items)
      setIsSelectMode(false)
      setSelectedItems(new Set())
    }
  }

  const handleBatchDelete = () => {
    // Exclude default versions from batch delete
    const deletableIds = Array.from(selectedItems).filter(id => {
      if (!downloadedSet.has(id)) return false
      if (id === `bible:${defaultVersion}`) return false
      return true
    })
    if (deletableIds.length === 0) return

    Alert.alert(t('Attention'), t('downloads.deleteCount', { count: deletableIds.length }), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          for (const id of deletableIds) {
            await deleteItem(id)
          }
          // Signal refresh
          getDefaultStore().set(installedVersionsSignalAtom, (c: number) => c + 1)
          setIsSelectMode(false)
          setSelectedItems(new Set())
        },
      },
    ])
  }

  const handleDownloadItem = (item: UnifiedItem) => {
    if (item.id.startsWith('bible:')) {
      const versionId = item.id.replace('bible:', '')
      enqueue([createBibleDownloadItem(versionId)])
    } else {
      const parts = item.id.split(':')
      enqueue([createDatabaseDownloadItem(parts[1] as DatabaseId, parts[2] as ResourceLanguage)])
    }
  }

  const handleRedownloadItem = (item: UnifiedItem) => {
    Alert.alert(t('Attention'), t('downloads.redownloadConfirm'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        onPress: async () => {
          await deleteItem(item.id)
          getDefaultStore().set(installedVersionsSignalAtom, (c: number) => c + 1)
          handleDownloadItem(item)
        },
      },
    ])
  }

  const handleDeleteItem = (item: UnifiedItem) => {
    Alert.alert(t('Attention'), t('downloads.deleteConfirm'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: async () => {
          await deleteItem(item.id)
          getDefaultStore().set(installedVersionsSignalAtom, (c: number) => c + 1)
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

      <SectionList
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
        renderSectionHeader={({ section }: { section: any }) => {
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
        renderItem={({ item }: { item: any }) => {
          const isDownloaded = downloadedSet.has(item.id)
          // Extract the raw database or version id for needsUpdate check
          let needsUpdateKey: string | undefined
          if (item.id.startsWith('bible:')) {
            needsUpdateKey = item.id.replace('bible:', '')
          } else if (item.id.startsWith('database:')) {
            needsUpdateKey = item.id.split(':')[1]
          }

          const isDefault = item.id === `bible:${defaultVersion}`

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
              onUpdate={() => {
                handleDeleteItem(item)
                handleDownloadItem(item)
              }}
              isDownloaded={isDownloaded}
              isDefault={isDefault}
              needsUpdate={needsUpdateKey ? needsUpdateMap[needsUpdateKey] : false}
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

// ---------------------------------------------------------------------------
// Delete helper
// ---------------------------------------------------------------------------

async function deleteItem(itemId: string): Promise<void> {
  if (itemId.startsWith('bible:')) {
    const versionId = itemId.replace('bible:', '')
    if (isStrongVersion(versionId)) {
      // Strong/Interlinear: delete SQLite file
      const path = requireBiblePath(versionId)
      const file = await FileSystem.getInfoAsync(path)
      if (file.exists) {
        await FileSystem.deleteAsync(file.uri)
      }
      if (versionId === 'INT' || versionId === 'INT_EN') {
        const lang = versionId === 'INT' ? 'fr' : 'en'
        await dbManager.getDB('INTERLINEAIRE', lang).delete()
      }
    } else {
      // Regular Bible: remove from bibles.sqlite
      const installed = await isVersionInstalled(versionId)
      if (installed) {
        await removeBibleVersion(versionId)
      }
      // Clean up legacy JSON
      const legacyPath = `${FileSystem.documentDirectory}bible-${versionId}.json`
      const legacyFile = await FileSystem.getInfoAsync(legacyPath)
      if (legacyFile.exists) {
        await FileSystem.deleteAsync(legacyFile.uri)
      }
    }
    deleteRedWordsFile(versionId)
    deletePericopeFile(versionId)
  } else if (itemId.startsWith('database:')) {
    const parts = itemId.split(':')
    const dbId = parts[1] as DatabaseId
    const lang = (parts[2] || 'fr') as ResourceLanguage
    const db = dbManager.getDB(dbId, lang)
    await db.delete()
  }
}

export default DownloadsScreen
