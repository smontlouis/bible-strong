import { produce } from 'immer'
import { useAtomValue, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable } from 'react-native'

import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Radio from '~common/ui/Radio'
import Text from '~common/ui/Text'
import type { StrongBibleProvenance } from '~features/resources/strongBibleResourceAccess'
import { versions } from '~helpers/bibleVersions'
import { createStrongSidecarDownloadPlan } from '~helpers/downloadItemFactory'
import {
  STRONG_BIBLE_FALLBACK_PRIORITY,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import {
  getStrongBibleSidecarAvailability,
  type StrongBibleSidecarAvailability,
} from '~helpers/strongBibleSidecar'
import { useDownloadItemStatus, useDownloadQueue } from '~helpers/useDownloadQueue'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import type { BibleTab } from '~state/tabs'

type SharedProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  resolvedProvenance: StrongBibleProvenance | null
}

type ButtonProps = SharedProps & {
  onPress: () => void
}

type SheetProps = SharedProps & {
  sheetRef: RefObject<SheetRef | null>
  isResourceModalOpen: boolean
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

const StrongBibleSourceRow = ({
  versionId,
  availability,
  isChecking,
  selected,
  onSelect,
  onDownload,
  isLast,
}: {
  versionId: StrongBibleVersionId
  availability?: StrongBibleSidecarAvailability
  isChecking: boolean
  selected: boolean
  onSelect: () => void
  onDownload: () => void
  isLast: boolean
}) => {
  const { t } = useTranslation()
  const bibleDownload = useDownloadItemStatus(`bible:${versionId}`)
  const strongDownload = useDownloadItemStatus(`bible-strong:${versionId}`)
  const activeDownload = [bibleDownload, strongDownload].find(state =>
    isActiveDownload(state?.status)
  )
  const failedDownload = [bibleDownload, strongDownload].find(state => state?.status === 'failed')
  const isAvailable = availability?.status === 'available'
  const version = versions[versionId]
  const progress =
    activeDownload?.status === 'inserting'
      ? 0.8 + activeDownload.insertProgress * 0.2
      : (activeDownload?.downloadProgress ?? 0)

  return (
    <Box
      row
      alignItems="center"
      minHeight={76}
      px={16}
      py={10}
      borderBottomWidth={isLast ? 0 : 1}
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
              {versionId}
            </Text>
            <Text fontSize={12} color="tertiary" mt={2} numberOfLines={1}>
              {version.name}
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
          onPress={onDownload}
          style={({ pressed }) => ({
            marginLeft: 12,
            minHeight: 40,
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Box row center minHeight={40} minWidth={96} px={12} borderRadius={20} bg="lightPrimary">
            <FeatherIcon
              name={failedDownload ? 'rotate-cw' : 'download'}
              size={14}
              color="primary"
            />
            <Text ml={6} fontSize={12} bold color="primary">
              {failedDownload ? t('downloads.retry') : t('downloads.download')}
            </Text>
          </Box>
        </Pressable>
      ) : null}
    </Box>
  )
}

export const StrongBibleSourceSheet = ({
  sheetRef,
  bibleAtom,
  isResourceModalOpen,
  resolvedProvenance,
}: SheetProps) => {
  const { t } = useTranslation()
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
  const strongBibleSourceVersionId = bible.data.strongBibleSourceVersionId

  const setStrongBibleSourceVersion = (versionId?: StrongBibleVersionId) => {
    setBible(updateStrongBibleSourceVersion(versionId))
  }

  useEffect(() => {
    if (!isResourceModalOpen && !isSheetOpen) return

    let cancelled = false
    Promise.all(
      STRONG_BIBLE_FALLBACK_PRIORITY.map(async versionId => ({
        versionId,
        availability: await getStrongBibleSidecarAvailability(versionId),
      }))
    )
      .then(results => {
        if (cancelled) return

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
        if (!cancelled) setAvailabilityByVersion(new Map())
      })

    return () => {
      cancelled = true
    }
  }, [
    downloadCompletionSignal,
    isResourceModalOpen,
    isSheetOpen,
    pendingSelectionVersionId,
    setBible,
    strongBibleSourceVersionId,
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

  const automaticDescription = strongBibleSourceVersionId
    ? t('strongSource.autoDescription.default')
    : resolvedProvenance
      ? resolvedProvenance.isFallback
        ? t('strongSource.autoDescription.available')
        : t('strongSource.autoDescription.openBible')
      : t('strongSource.autoDescription.default')

  return (
    <Sheet
      ref={sheetRef}
      onOpenChange={setIsSheetOpen}
      header={<SheetHeader title={t('strongSource.sheetTitle')} />}
    >
      <SheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Box overflow="hidden">
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: !strongBibleSourceVersionId }}
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
              <Radio selected={!strongBibleSourceVersionId} size={22} marginRight={12} />
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
          {STRONG_BIBLE_FALLBACK_PRIORITY.map((versionId, index) => (
            <StrongBibleSourceRow
              key={versionId}
              versionId={versionId}
              availability={availabilityByVersion?.get(versionId)}
              isChecking={!availabilityByVersion}
              selected={strongBibleSourceVersionId === versionId}
              onSelect={() => selectSource(versionId)}
              onDownload={() => void downloadSource(versionId)}
              isLast={index === STRONG_BIBLE_FALLBACK_PRIORITY.length - 1}
            />
          ))}
        </Box>
      </SheetScrollView>
    </Sheet>
  )
}
