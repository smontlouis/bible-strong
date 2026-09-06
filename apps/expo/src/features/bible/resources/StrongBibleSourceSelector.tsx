import { twMerge } from '~common/ui/classNames'

import { produce } from 'immer'
import { useAtomValue, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Platform, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sheet, SheetFlatList, SheetHeader, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'
import {
  type BhgLexiconAvailability,
  type LexiconBibleProvenance,
} from '~features/resources/lexiconBibleResourceAccess'
import { versions } from '~helpers/bibleVersions'
import {
  createInterlinearSidecarDownloadPlan,
  createStrongSidecarDownloadPlan,
} from '~helpers/downloadItemFactory'
import {
  ENGLISH_STRONG_BIBLE_PRIORITY,
  FRENCH_STRONG_BIBLE_PRIORITY,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { useDownloadItemStatus, useDownloadQueue } from '~helpers/useDownloadQueue'
import { getDownloadItemProgress, type DownloadItemState } from '~state/downloadQueue'
import type { BibleTab } from '~state/tabs'
import { getLanguage } from '~i18n'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import { toast } from '~helpers/toast'
import { localQueryOptions } from '~helpers/queryOptions'
import { loadStrongBibleSourceAvailability } from './loadStrongBibleSourceAvailability'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
type SharedProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  resolvedProvenance: LexiconBibleProvenance | null
}

type ButtonProps = SharedProps & {
  onPress: () => void
}

type SheetProps = SharedProps & {
  sheetRef: RefObject<SheetRef | null>
  isResourceModalOpen: boolean
}

const ENGLISH_FIRST_SOURCE_GROUPS = [
  {
    language: 'en',
    titleKey: 'versionCatalog.language.en',
    versionIds: ENGLISH_STRONG_BIBLE_PRIORITY,
  },
  {
    language: 'fr',
    titleKey: 'versionCatalog.language.fr',
    versionIds: FRENCH_STRONG_BIBLE_PRIORITY,
  },
] as const
const FRENCH_FIRST_SOURCE_GROUPS = [
  {
    language: 'fr',
    titleKey: 'versionCatalog.language.fr',
    versionIds: FRENCH_STRONG_BIBLE_PRIORITY,
  },
  {
    language: 'en',
    titleKey: 'versionCatalog.language.en',
    versionIds: ENGLISH_STRONG_BIBLE_PRIORITY,
  },
] as const

const EMPTY_STRONG_AVAILABILITY = new Map<StrongBibleVersionId, StrongBibleSidecarAvailability>()

type StrongBibleSourceLanguage = 'en' | 'fr'

type StrongBibleSourceListItem =
  | {
      type: 'section'
      key: string
      language: StrongBibleSourceLanguage
      titleKey: string
      expanded: boolean
    }
  | {
      type: 'source'
      key: StrongBibleVersionId
      versionId: StrongBibleVersionId
    }
  | {
      type: 'bhg-source'
      key: 'BHG'
    }

const updateStrongBibleSourceVersion = (versionId?: StrongBibleVersionId) =>
  produce((draft: BibleTab) => {
    draft.data.strongBibleSourceVersionId = versionId
  })

export const StrongBibleSourceButton = ({
  bibleAtom,
  resolvedProvenance,
  onPress,
}: ButtonProps) => {
  const { t } = useTranslation()
  const bible = useAtomValue(bibleAtom)
  const strongBibleSourceVersionId = bible.data.strongBibleSourceVersionId
  const label = strongBibleSourceVersionId
    ? strongBibleSourceVersionId
    : resolvedProvenance
      ? t('Automatique · {{version}}', { version: resolvedProvenance.versionId })
      : t('Automatique')
  const layoutKey = strongBibleSourceVersionId
    ? `manual-${strongBibleSourceVersionId}`
    : `auto-${resolvedProvenance?.versionId ?? 'pending'}`

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('strongSource.sheetTitle')}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      testID="strong-bible-source-selector"
    >
      <Box
        className="overflow-hidden border-continuous items-center justify-center min-h-[44px] px-[4px]"
        key={layoutKey}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center justify-center h-[32px] px-[10px] rounded-[16px] bg-light-grey max-w-[100px]">
          <Text className="text-[12px] font-bold" numberOfLines={1}>
            {label}
          </Text>
          <Box className="overflow-hidden border-continuous ml-[4px]">
            <FeatherIcon name="chevron-down" size={13} />
          </Box>
        </Box>
      </Box>
    </Pressable>
  )
}

const isActiveDownload = (status?: string) =>
  status === 'queued' || status === 'downloading' || status === 'inserting'

const StrongSourceRow = ({
  sourceId,
  name,
  isAvailable,
  isChecking,
  selected,
  onSelect,
  onDownload,
  activeDownload,
  failedDownload,
  availabilityError,
  downloadDisabled,
}: {
  sourceId: string
  name: string
  isAvailable: boolean
  isChecking: boolean
  selected: boolean
  onSelect: () => void
  onDownload: () => void
  activeDownload?: DownloadItemState
  failedDownload?: DownloadItemState
  availabilityError?: boolean
  downloadDisabled?: boolean
}) => {
  const { t } = useTranslation()
  const progress = activeDownload ? getDownloadItemProgress(activeDownload) : 0

  if (Platform.OS === 'web' && !isAvailable) return null

  return (
    <Box className="border-continuous overflow-hidden flex-row items-center min-h-[76px] px-[16px] py-[10px] border-b-[1px] border-border">
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled: !isAvailable }}
        disabled={!isAvailable}
        onPress={onSelect}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 56,
          justifyContent: 'center',
          opacity: pressed && isAvailable ? 0.7 : 1,
        })}
      >
        <Box className="overflow-hidden border-continuous flex-row items-center">
          <Radio
            className="mr-[12px]"
            selected={selected}
            style={{ opacity: isAvailable ? 1 : 0.4 }}
            size={22}
          />
          <Box className="overflow-hidden border-continuous flex-[1]">
            <Text className="text-[15px] font-bold">{sourceId}</Text>
            <Text className="text-[12px] text-tertiary mt-[2px]" numberOfLines={1}>
              {name}
            </Text>
          </Box>
        </Box>
      </Pressable>

      {isChecking ? (
        <Box className="overflow-hidden border-continuous w-[40px] ml-[12px] items-center justify-center">
          <ActivityIndicator size="small" />
        </Box>
      ) : activeDownload ? (
        <Box className="overflow-hidden border-continuous w-[88px] ml-[12px] items-end">
          <Text
            className="text-[11px] text-tertiary"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {activeDownload.status === 'queued'
              ? t('downloads.queue')
              : activeDownload.status === 'inserting'
                ? t('downloads.inserting')
                : `${Math.round(progress * 100)} %`}
          </Text>
          <Box className="border-continuous overflow-visible mt-[6px] w-[88px] h-[4px] rounded-[2px] bg-border">
            <Box
              className={twMerge(
                'overflow-hidden border-continuous',
                twMerge(
                  activeDownload.status === 'inserting' ? 'bg-success' : 'bg-primary',
                  'overflow-hidden border-continuous h-[4px] rounded-[2px]'
                )
              )}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </Box>
        </Box>
      ) : !isAvailable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            availabilityError
              ? t('resource.action.temporarilyUnavailable')
              : downloadDisabled
                ? t('resource.action.connectionRequired')
                : failedDownload
                  ? t('downloads.retry')
                  : t('downloads.download')
          }
          accessibilityState={{ disabled: downloadDisabled }}
          disabled={downloadDisabled}
          onPress={onDownload}
          style={({ pressed }) => ({
            marginLeft: 12,
            width: 48,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <FeatherIcon
            name={
              availabilityError || failedDownload
                ? 'rotate-cw'
                : downloadDisabled
                  ? 'wifi-off'
                  : 'download-cloud'
            }
            size={16}
          />
        </Pressable>
      ) : null}
    </Box>
  )
}

const StrongBibleSourceRow = ({
  versionId,
  availability,
  isChecking,
  selected,
  onSelect,
  onDownload,
  availabilityError,
  downloadDisabled,
}: {
  versionId: StrongBibleVersionId
  availability?: StrongBibleSidecarAvailability
  isChecking: boolean
  selected: boolean
  onSelect: () => void
  onDownload: () => void
  availabilityError?: boolean
  downloadDisabled?: boolean
}) => {
  const bibleDownload = useDownloadItemStatus(createOfflineCopyId({ kind: 'bible', versionId }))
  const strongDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-bible-index', versionId })
  )
  const downloads = [bibleDownload, strongDownload]

  return (
    <StrongSourceRow
      sourceId={versionId}
      name={versions[versionId].name}
      isAvailable={availability?.status === 'available'}
      isChecking={isChecking}
      selected={selected}
      onSelect={onSelect}
      onDownload={onDownload}
      activeDownload={downloads.find(state => isActiveDownload(state?.status))}
      failedDownload={downloads.find(state => state?.status === 'failed')}
      availabilityError={availabilityError}
      downloadDisabled={downloadDisabled}
    />
  )
}

const BhgStrongSourceRow = ({
  availability,
  selected,
  onSelect,
  onDownload,
  availabilityError,
  downloadDisabled,
  isChecking,
}: {
  availability?: BhgLexiconAvailability
  selected: boolean
  onSelect: () => void
  onDownload: () => void
  availabilityError?: boolean
  downloadDisabled?: boolean
  isChecking: boolean
}) => {
  const bibleDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'bible', versionId: 'BHG' })
  )
  const frenchDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: 'fr' })
  )
  const englishDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'interlinear-index', versionId: 'BHG', language: 'en' })
  )
  const downloads = [bibleDownload, frenchDownload, englishDownload]

  return (
    <StrongSourceRow
      sourceId="BHG"
      name={versions.BHG.name}
      isAvailable={availability?.status === 'available'}
      isChecking={isChecking}
      selected={selected}
      onSelect={onSelect}
      onDownload={onDownload}
      activeDownload={downloads.find(state => isActiveDownload(state?.status))}
      failedDownload={downloads.find(state => state?.status === 'failed')}
      availabilityError={availabilityError}
      downloadDisabled={downloadDisabled}
    />
  )
}

export const StrongBibleSourceSheet = ({
  sheetRef,
  bibleAtom,
  isResourceModalOpen,
  resolvedProvenance,
}: SheetProps) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const isConnected = useConnection()
  const insets = useSafeAreaInsets()
  const bible = useAtomValue(bibleAtom)
  const setBible = useSetAtom(bibleAtom)
  const resourceRegistry = useOfflineResourceRegistry()
  const { enqueue } = useDownloadQueue()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [pendingSelectionVersionId, setPendingSelectionVersionId] = useState<StrongBibleVersionId>()
  const strongBibleSourceVersionId = bible.data.strongBibleSourceVersionId
  const isBhgBible = bible.data.selectedVersion === 'BHG'
  const preferredInterlinearLocale = bible.data.interlinearLocale ?? getLanguage()
  const isEnglishBible = versions[bible.data.selectedVersion]?.language === 'en'
  const sourceGroups = isEnglishBible ? ENGLISH_FIRST_SOURCE_GROUPS : FRENCH_FIRST_SOURCE_GROUPS
  const [expandedLanguages, setExpandedLanguages] = useState<
    Record<StrongBibleSourceLanguage, boolean>
  >({
    en: isEnglishBible,
    fr: !isEnglishBible,
  })
  const standardSourceListData: StrongBibleSourceListItem[] = sourceGroups.flatMap(group => {
    const section: StrongBibleSourceListItem = {
      type: 'section',
      key: group.titleKey,
      language: group.language,
      titleKey: group.titleKey,
      expanded: expandedLanguages[group.language],
    }
    if (!section.expanded) return [section]

    return [
      section,
      ...group.versionIds.map(versionId => ({
        type: 'source' as const,
        key: versionId,
        versionId,
      })),
    ]
  })
  const sourceListData: StrongBibleSourceListItem[] = isBhgBible
    ? [{ type: 'bhg-source', key: 'BHG' }, ...standardSourceListData]
    : standardSourceListData

  const setStrongBibleSourceVersion = (versionId?: StrongBibleVersionId) => {
    setBible(updateStrongBibleSourceVersion(versionId))
  }

  const sourceAvailabilitySignal = [
    ...sourceGroups.flatMap(group =>
      group.versionIds.map(versionId =>
        getOfflineResourceQuerySignal(resourceRegistry, {
          kind: 'strong-bible-index',
          versionId,
        })
      )
    ),
    ...(isBhgBible
      ? [
          getOfflineResourceQuerySignal(resourceRegistry, {
            kind: 'bible',
            versionId: 'BHG',
          }),
          getOfflineResourceQuerySignal(resourceRegistry, {
            kind: 'interlinear-index',
            versionId: 'BHG',
            language: preferredInterlinearLocale,
          }),
        ]
      : []),
  ]

  const availabilityQuery = useQuery({
    queryKey: [
      'strong-bible-source-availability',
      isEnglishBible ? 'en' : 'fr',
      isBhgBible,
      preferredInterlinearLocale,
      sourceAvailabilitySignal,
    ],
    queryFn: () =>
      loadStrongBibleSourceAvailability({
        versionIds: sourceGroups.flatMap(group => [...group.versionIds]),
        includeBhg: isBhgBible,
        preferredInterlinearLocale,
        getStrongAvailability: resources.strongBible.getAvailability,
        getInterlinearAvailability: resources.lexiconBible.getInterlinearAvailability,
      }),
    enabled: isResourceModalOpen || isSheetOpen,
    ...localQueryOptions,
  })
  const availabilityByVersion =
    availabilityQuery.data?.availabilityByVersion ?? EMPTY_STRONG_AVAILABILITY
  const bhgAvailability: BhgLexiconAvailability | undefined =
    availabilityQuery.data?.bhgAvailability

  useEffect(() => {
    if (!availabilityQuery.isSuccess) return
    if (
      pendingSelectionVersionId &&
      availabilityByVersion.get(pendingSelectionVersionId)?.status === 'available'
    ) {
      setBible(updateStrongBibleSourceVersion(pendingSelectionVersionId))
      setPendingSelectionVersionId(undefined)
      return
    }
  }, [availabilityByVersion, availabilityQuery.isSuccess, pendingSelectionVersionId, setBible])

  const selectSource = (versionId?: StrongBibleVersionId) => {
    setPendingSelectionVersionId(undefined)
    setStrongBibleSourceVersion(versionId)
    sheetRef.current?.dismiss()
  }

  const downloadSource = async (versionId: StrongBibleVersionId) => {
    if (Platform.OS === 'web') return
    if (!isConnected) return
    try {
      const availability =
        availabilityByVersion.get(versionId) ??
        (await resources.strongBible.getAvailability(versionId))
      setPendingSelectionVersionId(versionId)
      enqueue(createStrongSidecarDownloadPlan(versionId, availability.status))
    } catch {
      toast.error(t('resource.action.temporarilyUnavailable'))
    }
  }

  const downloadBhgSource = async () => {
    if (Platform.OS === 'web') return
    if (!isConnected) return
    try {
      const availability = await resources.lexiconBible.getInterlinearAvailability(
        preferredInterlinearLocale
      )
      if (availability.status === 'available') {
        selectSource()
        return
      }
      setStrongBibleSourceVersion()
      enqueue(createInterlinearSidecarDownloadPlan(preferredInterlinearLocale, availability.status))
    } catch {
      toast.error(t('resource.action.temporarilyUnavailable'))
    }
  }

  const automaticDescription = strongBibleSourceVersionId
    ? t('strongSource.autoDescription.default')
    : resolvedProvenance
      ? resolvedProvenance.isFallback
        ? t('strongSource.autoDescription.available')
        : t('strongSource.autoDescription.openBible')
      : t('strongSource.autoDescription.default')

  const handleSheetOpenChange = (isOpen: boolean) => {
    setIsSheetOpen(isOpen)
    if (!isOpen) return

    setExpandedLanguages({
      en: isEnglishBible,
      fr: !isEnglishBible,
    })
  }

  return (
    <Sheet
      ref={sheetRef}
      onOpenChange={handleSheetOpenChange}
      header={<SheetHeader title={t('strongSource.sheetTitle')} />}
      snapPoints={[0.5, 1]}
    >
      <SheetFlatList
        data={sourceListData}
        keyExtractor={item => item.key}
        contentContainerStyle={{
          paddingBottom: 28 + insets.bottom,
        }}
        ListHeaderComponent={
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{
              checked: !strongBibleSourceVersionId && resolvedProvenance?.versionId !== 'BHG',
            }}
            onPress={() => selectSource()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Box className="border-continuous overflow-hidden flex-row items-center min-h-[76px] px-[16px] py-[10px] border-b-[1px] border-border">
              <Radio
                className="mr-[12px]"
                selected={!strongBibleSourceVersionId && resolvedProvenance?.versionId !== 'BHG'}
                size={22}
              />
              <Box className="overflow-hidden border-continuous flex-[1]">
                <Text className="text-[15px] font-bold">{t('Automatique')}</Text>
                <Text className="text-[12px] text-tertiary mt-[3px]">{automaticDescription}</Text>
              </Box>
            </Box>
          </Pressable>
        }
        renderItem={({ item }) =>
          item.type === 'section' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(item.titleKey)}
              accessibilityState={{ expanded: item.expanded }}
              onPress={() =>
                setExpandedLanguages(current => ({
                  ...current,
                  [item.language]: !current[item.language],
                }))
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Box className="border-continuous overflow-hidden min-h-[48px] pl-[20px] pr-[8px] flex-row items-center bg-light-grey border-b-[1px] border-border">
                <Text className="flex-[1] text-[16px] opacity-[0.8]">{t(item.titleKey)}</Text>
                <Box className="overflow-hidden border-continuous w-[40px] h-[40px] items-center justify-center">
                  <FeatherIcon
                    name={item.expanded ? 'chevron-down' : 'chevron-right'}
                    size={20}
                    color="tertiary"
                  />
                </Box>
              </Box>
            </Pressable>
          ) : item.type === 'bhg-source' ? (
            <BhgStrongSourceRow
              availability={bhgAvailability}
              availabilityError={availabilityQuery.isError}
              downloadDisabled={!isConnected && !availabilityQuery.isError}
              isChecking={availabilityQuery.isPending || availabilityQuery.isFetching}
              selected={!strongBibleSourceVersionId && resolvedProvenance?.versionId === 'BHG'}
              onSelect={() => selectSource()}
              onDownload={() =>
                availabilityQuery.isError
                  ? void availabilityQuery.refetch()
                  : void downloadBhgSource()
              }
            />
          ) : (
            <StrongBibleSourceRow
              versionId={item.versionId}
              availability={availabilityByVersion.get(item.versionId)}
              isChecking={availabilityQuery.isPending || availabilityQuery.isFetching}
              availabilityError={availabilityQuery.isError}
              downloadDisabled={!isConnected && !availabilityQuery.isError}
              selected={strongBibleSourceVersionId === item.versionId}
              onSelect={() => selectSource(item.versionId)}
              onDownload={() =>
                availabilityQuery.isError
                  ? void availabilityQuery.refetch()
                  : void downloadSource(item.versionId)
              }
            />
          )
        }
      />
    </Sheet>
  )
}
