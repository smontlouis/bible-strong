import { produce } from 'immer'
import { useAtomValue, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Sheet, SheetFlatList, SheetHeader, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'
import {
  getBhgLexiconAvailability,
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
import {
  getInterlinearSidecarAvailability,
  type InterlinearSidecarAvailability,
} from '~helpers/interlinearBibleSidecar'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import { useDownloadItemStatus, useDownloadQueue } from '~helpers/useDownloadQueue'
import {
  downloadCompletionSignalAtom,
  getDownloadItemProgress,
  type DownloadItemState,
} from '~state/downloadQueue'
import type { BibleTab } from '~state/tabs'
import { getLanguage } from '~i18n'

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
      <Box key={layoutKey} center minHeight={44} px={4}>
        <Box row center height={32} px={10} borderRadius={16} bg="lightGrey" maxWidth={100}>
          <Text numberOfLines={1} fontSize={12} bold>
            {label}
          </Text>
          <Box ml={4}>
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
}) => {
  const { t } = useTranslation()
  const progress = activeDownload ? getDownloadItemProgress(activeDownload) : 0

  return (
    <Box
      row
      alignItems="center"
      minHeight={76}
      px={16}
      py={10}
      borderBottomWidth={1}
      borderColor="border"
    >
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
        <Box row alignItems="center">
          <Radio selected={selected} size={22} marginRight={12} opacity={isAvailable ? 1 : 0.4} />
          <Box flex>
            <Text fontSize={15} bold>
              {sourceId}
            </Text>
            <Text fontSize={12} color="tertiary" mt={2} numberOfLines={1}>
              {name}
            </Text>
          </Box>
        </Box>
      </Pressable>

      {isChecking ? (
        <Box width={40} ml={12} center>
          <ActivityIndicator size="small" />
        </Box>
      ) : activeDownload ? (
        <Box width={88} ml={12} alignItems="flex-end">
          <Text
            fontSize={11}
            color="tertiary"
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {activeDownload.status === 'queued'
              ? t('downloads.queue')
              : activeDownload.status === 'inserting'
                ? t('downloads.inserting')
                : `${Math.round(progress * 100)} %`}
          </Text>
          <Box mt={6} width={88} height={4} borderRadius={2} bg="border" overflow="hidden">
            <Box
              height={4}
              borderRadius={2}
              bg={activeDownload.status === 'inserting' ? 'success' : 'primary'}
              width={`${Math.round(progress * 100)}%`}
            />
          </Box>
        </Box>
      ) : !isAvailable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={failedDownload ? t('downloads.retry') : t('downloads.download')}
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
          <FeatherIcon name={failedDownload ? 'rotate-cw' : 'download-cloud'} size={16} />
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
}: {
  versionId: StrongBibleVersionId
  availability?: StrongBibleSidecarAvailability
  isChecking: boolean
  selected: boolean
  onSelect: () => void
  onDownload: () => void
}) => {
  const bibleDownload = useDownloadItemStatus(`bible:${versionId}`)
  const strongDownload = useDownloadItemStatus(`bible-strong:${versionId}`)
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
    />
  )
}

const BhgStrongSourceRow = ({
  availability,
  selected,
  onSelect,
  onDownload,
}: {
  availability?: BhgLexiconAvailability
  selected: boolean
  onSelect: () => void
  onDownload: () => void
}) => {
  const bibleDownload = useDownloadItemStatus('bible:BHG')
  const frenchDownload = useDownloadItemStatus('bible-interlinear:BHG:fr')
  const englishDownload = useDownloadItemStatus('bible-interlinear:BHG:en')
  const downloads = [bibleDownload, frenchDownload, englishDownload]

  return (
    <StrongSourceRow
      sourceId="BHG"
      name={versions.BHG.name}
      isAvailable={availability?.status === 'available'}
      isChecking={!availability}
      selected={selected}
      onSelect={onSelect}
      onDownload={onDownload}
      activeDownload={downloads.find(state => isActiveDownload(state?.status))}
      failedDownload={downloads.find(state => state?.status === 'failed')}
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
  const insets = useSafeAreaInsets()
  const bible = useAtomValue(bibleAtom)
  const setBible = useSetAtom(bibleAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const { enqueue } = useDownloadQueue()
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [pendingSelectionVersionId, setPendingSelectionVersionId] = useState<StrongBibleVersionId>()
  const [availabilityByVersion, setAvailabilityByVersion] = useState<Map<
    StrongBibleVersionId,
    StrongBibleSidecarAvailability
  > | null>(null)
  const [bhgAvailability, setBhgAvailability] = useState<BhgLexiconAvailability>()
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

  useEffect(() => {
    if (!isResourceModalOpen && !isSheetOpen) return

    let cancelled = false
    Promise.all([
      Promise.all(
        sourceGroups.flatMap(group =>
          group.versionIds.map(async versionId => ({
            versionId,
            availability: await getStrongBibleSidecarAvailability(versionId),
          }))
        )
      ),
      isBhgBible
        ? getBhgLexiconAvailability(preferredInterlinearLocale)
        : Promise.resolve(undefined),
    ])
      .then(([results, nextBhgAvailability]) => {
        if (cancelled) return
        setBhgAvailability(nextBhgAvailability)

        const nextAvailability = new Map<StrongBibleVersionId, StrongBibleSidecarAvailability>(
          results.map(({ versionId, availability }) => [versionId, availability] as const)
        )
        setAvailabilityByVersion(nextAvailability)

        if (
          pendingSelectionVersionId &&
          nextAvailability.get(pendingSelectionVersionId)?.status === 'available'
        ) {
          setBible(updateStrongBibleSourceVersion(pendingSelectionVersionId))
          setPendingSelectionVersionId(undefined)
          return
        }

        if (
          strongBibleSourceVersionId &&
          nextAvailability.get(strongBibleSourceVersionId)?.status !== 'available'
        ) {
          setBible(updateStrongBibleSourceVersion())
        }
      })
      .catch(() => {
        if (cancelled) return
        setAvailabilityByVersion(new Map())
        setBhgAvailability(
          isBhgBible
            ? {
                status: 'unavailable',
                attempts: [],
              }
            : undefined
        )
      })

    return () => {
      cancelled = true
    }
  }, [
    downloadCompletionSignal,
    isResourceModalOpen,
    isSheetOpen,
    isBhgBible,
    pendingSelectionVersionId,
    preferredInterlinearLocale,
    setBible,
    strongBibleSourceVersionId,
    sourceGroups,
  ])

  const selectSource = (versionId?: StrongBibleVersionId) => {
    setPendingSelectionVersionId(undefined)
    setStrongBibleSourceVersion(versionId)
    sheetRef.current?.dismiss()
  }

  const downloadSource = async (versionId: StrongBibleVersionId) => {
    const availability =
      availabilityByVersion?.get(versionId) ?? (await getStrongBibleSidecarAvailability(versionId))
    setPendingSelectionVersionId(versionId)
    enqueue(createStrongSidecarDownloadPlan(versionId, availability.status))
  }

  const downloadBhgSource = async () => {
    const availability: InterlinearSidecarAvailability = await getInterlinearSidecarAvailability(
      preferredInterlinearLocale
    )
    if (availability.status === 'available') {
      selectSource()
      return
    }
    setStrongBibleSourceVersion()
    enqueue(createInterlinearSidecarDownloadPlan(preferredInterlinearLocale, availability.status))
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
            <Box
              row
              alignItems="center"
              minHeight={76}
              px={16}
              py={10}
              borderBottomWidth={1}
              borderColor="border"
            >
              <Radio
                selected={!strongBibleSourceVersionId && resolvedProvenance?.versionId !== 'BHG'}
                size={22}
                marginRight={12}
              />
              <Box flex>
                <Text fontSize={15} bold>
                  {t('Automatique')}
                </Text>
                <Text fontSize={12} color="tertiary" mt={3}>
                  {automaticDescription}
                </Text>
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
                  {t(item.titleKey)}
                </Text>
                <Box width={40} height={40} center>
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
              selected={!strongBibleSourceVersionId && resolvedProvenance?.versionId === 'BHG'}
              onSelect={() => selectSource()}
              onDownload={() => void downloadBhgSource()}
            />
          ) : (
            <StrongBibleSourceRow
              versionId={item.versionId}
              availability={availabilityByVersion?.get(item.versionId)}
              isChecking={!availabilityByVersion}
              selected={strongBibleSourceVersionId === item.versionId}
              onSelect={() => selectSource(item.versionId)}
              onDownload={() => void downloadSource(item.versionId)}
            />
          )
        }
      />
    </Sheet>
  )
}
