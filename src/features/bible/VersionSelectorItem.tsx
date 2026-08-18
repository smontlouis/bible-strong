import React from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Linking, Platform, TouchableOpacity } from 'react-native'

import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { Version } from '~helpers/bibleVersions'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { installedVersionsSignalAtom, bibleDataRefreshSignalAtom } from '~state/app'
import { downloadManager } from '~helpers/downloadManager'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import {
  createBibleDownloadItem,
  createStrongSidecarDownloadPlan,
} from '~helpers/downloadItemFactory'
import { VersionCode } from 'src/state/tabs'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  getStrongBibleAttributionKey,
  isStrongCapableBibleVersion,
} from '~helpers/strongBiblePublications'
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import StrongIndexSelectorItem from './StrongIndexSelectorItem'
import StrongMark from './StrongMark'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import InterlinearIndexSelectorItem from './InterlinearIndexSelectorItem'
import InterlinearMark from './InterlinearMark'
import { downloadCompletionSignalAtom, getDownloadItemProgress } from '~state/downloadQueue'
import { useResourcePublicationStatus } from '~helpers/useResourcePublicationStatus'
import { getBibleRelatedPublicationResources } from '~helpers/bibleRelatedPublications'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import {
  createDownloadedItemDeletionPlan,
  deleteDownloadedItem,
} from '~helpers/deleteDownloadedItem'
import useConnection from '~helpers/useConnection'
import {
  getBibleOfflineDetailsQueryKey,
  getStrongOfflineDetailsQueryKey,
} from './VersionSelectorSheet/bibleOfflineDetailsQueryKeys'

const getVersionDownloadQueryKey = (
  versionId: string,
  isOnboardingCompleted: boolean,
  installedVersionsSignal: number
) =>
  [
    'bible-version-needs-download',
    versionId,
    isOnboardingCompleted,
    installedVersionsSignal,
  ] as const

const VersionItemContainer = ({
  children,
  needsUpdate,
  hasDependency,
  selected,
  onPress,
}: React.PropsWithChildren<{
  needsUpdate?: boolean
  hasDependency?: boolean
  selected?: boolean
  onPress?: () => void
}>) => {
  const content = (
    <Box
      minHeight={76}
      pl={20}
      pr={4}
      py={12}
      borderBottomWidth={hasDependency ? 0 : 1}
      borderColor="border"
      borderLeftWidth={selected ? 3 : needsUpdate ? 5 : 0}
      borderLeftColor={selected ? 'primary' : needsUpdate ? 'success' : undefined}
    >
      {children}
    </Box>
  )

  return onPress ? <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity> : content
}

const ActionColumn = ({ children, opacity }: React.PropsWithChildren<{ opacity?: number }>) => (
  <Box width={48} minHeight={48} center opacity={opacity}>
    {children}
  </Box>
)

const ActionButton = ({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
}: React.PropsWithChildren<{
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}>) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={event => {
      event.stopPropagation()
      onPress()
    }}
  >
    <ActionColumn>{children}</ActionColumn>
  </TouchableOpacity>
)

const VersionIdentity = ({
  version,
  color,
  showPublicationDetails = false,
  showCapabilities = false,
  copyrightColor,
  copyrightOpacity,
  copyrightStyle,
  onCopyrightPress,
  showStrongCapability,
  isStrongIndexAvailable,
  isStrongIndexExpanded,
  onToggleStrongIndex,
  strongToggleLabel,
  strongAttribution,
  showInterlinearCapability,
  isInterlinearIndexAvailable,
  isInterlinearIndexExpanded,
  onToggleInterlinearIndex,
  interlinearToggleLabel,
  interlinearAttribution,
  passiveCapabilities = false,
}: {
  version: Version & { displayName?: string }
  color: string
  showPublicationDetails?: boolean
  showCapabilities?: boolean
  copyrightColor?: string
  copyrightOpacity?: number
  copyrightStyle?: { textDecorationLine: 'underline' }
  onCopyrightPress?: () => void
  showStrongCapability?: boolean
  isStrongIndexAvailable?: boolean
  isStrongIndexExpanded?: boolean
  onToggleStrongIndex?: () => void
  strongToggleLabel?: string
  strongAttribution?: string
  showInterlinearCapability?: boolean
  isInterlinearIndexAvailable?: boolean
  isInterlinearIndexExpanded?: boolean
  onToggleInterlinearIndex?: () => void
  interlinearToggleLabel?: string
  interlinearAttribution?: string
  passiveCapabilities?: boolean
}) => (
  <Box flex>
    <Text color={color} fontSize={12} opacity={0.5} bold>
      {version.id}
    </Text>
    <HStack alignItems="center">
      <Text color={color} fontSize={16}>
        {version.displayName || version.name}
      </Text>
      {showCapabilities && version.hasAudio && (
        <Box ml={4}>
          <FeatherIcon name="volume-2" size={16} color="primary" />
        </Box>
      )}
      {showCapabilities &&
        showStrongCapability &&
        (onToggleStrongIndex ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={strongToggleLabel}
            accessibilityState={{ expanded: isStrongIndexExpanded }}
            onPress={event => {
              event.stopPropagation()
              onToggleStrongIndex()
            }}
          >
            <Box width={38} height={28} center ml={5} overflow="visible">
              <Box position="relative" width={22} height={24} center overflow="visible">
                <StrongMark highlighted={isStrongIndexAvailable} />
                <Box position="absolute" width={16} height={16} center right={-10} bottom={0}>
                  <FeatherIcon
                    name={isStrongIndexExpanded ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color="tertiary"
                  />
                </Box>
              </Box>
            </Box>
          </TouchableOpacity>
        ) : (
          <Box ml={5}>
            <StrongMark highlighted={isStrongIndexAvailable} passive={passiveCapabilities} />
          </Box>
        ))}
      {showCapabilities &&
        showInterlinearCapability &&
        (onToggleInterlinearIndex ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={interlinearToggleLabel}
            accessibilityState={{ expanded: isInterlinearIndexExpanded }}
            onPress={event => {
              event.stopPropagation()
              onToggleInterlinearIndex()
            }}
          >
            <Box width={38} height={28} center ml={5} overflow="visible">
              <Box position="relative" width={22} height={24} center overflow="visible">
                <InterlinearMark highlighted={isInterlinearIndexAvailable} />
                <Box position="absolute" width={16} height={16} center right={-10} bottom={0}>
                  <FeatherIcon
                    name={isInterlinearIndexExpanded ? 'chevron-up' : 'chevron-down'}
                    size={12}
                    color="tertiary"
                  />
                </Box>
              </Box>
            </Box>
          </TouchableOpacity>
        ) : (
          <Box ml={5}>
            <InterlinearMark
              highlighted={isInterlinearIndexAvailable}
              passive={passiveCapabilities}
            />
          </Box>
        ))}
    </HStack>
    {showPublicationDetails && (
      <Text
        color={copyrightColor}
        fontSize={10}
        opacity={copyrightOpacity}
        onPress={onCopyrightPress}
        style={copyrightStyle}
      >
        {version.c}
      </Text>
    )}
    {showPublicationDetails &&
      isStrongIndexAvailable &&
      !isStrongIndexExpanded &&
      strongAttribution && (
        <Text color={color} fontSize={10} opacity={0.5}>
          {strongAttribution}
        </Text>
      )}
    {showPublicationDetails &&
      isInterlinearIndexAvailable &&
      !isInterlinearIndexExpanded &&
      interlinearAttribution && (
        <Text color={color} fontSize={10} opacity={0.5}>
          {interlinearAttribution}
        </Text>
      )}
  </Box>
)

interface Props {
  version: Version & { displayName?: string }
  isSelected?: boolean
  onChange?: (id: VersionCode) => void
  isParameters?: boolean
  shareFn?: (fn: () => void) => void
  onDownloadStart?: (id: VersionCode) => void
  onDownloadComplete?: (id: VersionCode) => void
  showSelectionCheckbox?: boolean
  showStrongIndex?: boolean
  strongCollapseKey?: number
  selectionRequirement?: 'bible' | 'strong'
  onOpenOfflineDetails?: (version: Version & { displayName?: string }) => void
}

const VersionSelectorItem = ({
  version,
  isSelected,
  onChange,
  isParameters,
  shareFn,
  onDownloadStart,
  onDownloadComplete,
  showSelectionCheckbox,
  showStrongIndex,
  strongCollapseKey,
  selectionRequirement = 'bible',
  onOpenOfflineDetails,
}: Props) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const [isStrongIndexAvailable, setStrongIndexAvailable] = React.useState<boolean>()
  const [isStrongIndexExpanded, setStrongIndexExpanded] = React.useState(false)
  const [isFrenchInterlinearIndexAvailable, setFrenchInterlinearIndexAvailable] =
    React.useState<boolean>()
  const [isEnglishInterlinearIndexAvailable, setEnglishInterlinearIndexAvailable] =
    React.useState<boolean>()
  const [isInterlinearIndexExpanded, setInterlinearIndexExpanded] = React.useState(false)
  const queryClient = useQueryClient()
  const isConnected = useConnection()
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const installedVersionsSignal = useAtomValue(installedVersionsSignalAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)

  // Subscribe to download queue state for this item
  const itemId = createOfflineCopyId({ kind: 'bible', versionId: version.id })
  const queueState = useDownloadItemStatus(itemId)
  const previousBibleDownloadStatusRef = React.useRef(queueState?.status)
  const strongVersionId = isStrongCapableBibleVersion(version.id) ? version.id : undefined
  const requiresStrong = selectionRequirement === 'strong' && Boolean(strongVersionId)
  const versionAvailabilityQuery = useQuery({
    queryKey: getVersionDownloadQueryKey(
      version.id,
      isOnboardingCompleted,
      installedVersionsSignal
    ),
    queryFn: async () =>
      !(await resources.offlineCopies.isAvailable({ kind: 'bible', versionId: version.id })),
    placeholderData: keepPreviousData,
  })
  const versionNeedsDownload = versionAvailabilityQuery.data
  const bibleDownloadItem = createBibleDownloadItem(version.id)
  const publicationStatus = useResourcePublicationStatus({
    resourceId: bibleDownloadItem.id,
    isInstalled: versionNeedsDownload === false,
    relatedResources: getBibleRelatedPublicationResources(version.id),
  })
  const needsUpdate = publicationStatus.status === 'update-available'
  const strongSelectionQuery = useQuery({
    queryKey: [
      'strong-selection-availability',
      strongVersionId,
      installedVersionsSignal,
      downloadCompletionSignal,
    ],
    queryFn: () => resources.strongBible.getAvailability(strongVersionId!),
    enabled: requiresStrong || Boolean(onOpenOfflineDetails && strongVersionId),
    placeholderData: keepPreviousData,
  })
  const strongSelectionAvailability: StrongBibleSidecarAvailability | undefined =
    strongSelectionQuery.data
  const strongPresent =
    strongSelectionAvailability?.status === 'available' ||
    strongSelectionAvailability?.status === 'incompatible' ||
    strongSelectionAvailability?.status === 'corrupt'
  const strongQueueState = useDownloadItemStatus(
    isStrongCapableBibleVersion(version.id)
      ? createOfflineCopyId({ kind: 'strong-bible-index', versionId: version.id })
      : undefined
  )
  const activeQueueState = requiresStrong
    ? [queueState, strongQueueState].find(
        state =>
          state?.status === 'queued' ||
          state?.status === 'downloading' ||
          state?.status === 'inserting'
      )
    : queueState
  const isLoading =
    activeQueueState?.status === 'downloading' || activeQueueState?.status === 'inserting'
  const isQueued = activeQueueState?.status === 'queued'
  const downloadProgress = activeQueueState ? getDownloadItemProgress(activeQueueState) : 0
  const showStrongCapability = (showStrongIndex || requiresStrong) && Boolean(strongVersionId)
  const toggleStrongIndex = () => setStrongIndexExpanded(expanded => !expanded)
  const strongToggleLabel = isStrongIndexExpanded
    ? t('versionSelector.hideStrongIndex', { bible: version.id })
    : t('versionSelector.showStrongIndex', { bible: version.id })
  const showInterlinearCapability = showStrongIndex && isInterlinearCapableBibleVersion(version.id)
  const isInterlinearIndexAvailable =
    isFrenchInterlinearIndexAvailable === true || isEnglishInterlinearIndexAvailable === true
  const toggleInterlinearIndex = () => setInterlinearIndexExpanded(expanded => !expanded)
  const interlinearToggleLabel = isInterlinearIndexExpanded
    ? t('versionSelector.hideInterlinearIndex')
    : t('versionSelector.showInterlinearIndex')
  const openSourceUrl = () => {
    if (version.sourceUrl) {
      Linking.openURL(version.sourceUrl)
    }
  }

  const openOfflineDetails = async () => {
    if (!onOpenOfflineDetails) return

    const bibleInstalled =
      versionNeedsDownload === undefined || versionAvailabilityQuery.isPlaceholderData
        ? await resources.offlineCopies.isAvailable({ kind: 'bible', versionId: version.id })
        : !versionNeedsDownload
    const strongAvailability = strongVersionId
      ? strongSelectionAvailability && !strongSelectionQuery.isPlaceholderData
        ? strongSelectionAvailability
        : await resources.strongBible.getAvailability(strongVersionId)
      : undefined

    queryClient.setQueryData(
      getBibleOfflineDetailsQueryKey(version.id, installedVersionsSignal, downloadCompletionSignal),
      bibleInstalled
    )
    if (strongVersionId && strongAvailability) {
      queryClient.setQueryData(
        getStrongOfflineDetailsQueryKey(
          strongVersionId,
          installedVersionsSignal,
          downloadCompletionSignal
        ),
        strongAvailability
      )
    }

    onOpenOfflineDetails(version)
  }

  const versionColor = isSelected ? 'primary' : 'default'
  const copyrightColor = version.sourceUrl ? 'primary' : versionColor
  const copyrightOpacity = version.sourceUrl ? 0.75 : 0.5
  const copyrightStyle = version.sourceUrl
    ? { textDecorationLine: 'underline' as const }
    : undefined

  const startDownload = async () => {
    if (!isConnected) return
    if (versionAvailabilityQuery.isError || strongSelectionQuery.isError) {
      await Promise.all([versionAvailabilityQuery.refetch(), strongSelectionQuery.refetch()])
      return
    }
    if (requiresStrong && strongVersionId) {
      const availability =
        strongSelectionAvailability ??
        (await resources.strongBible.getAvailability(strongVersionId))
      onDownloadStart?.(version.id)
      downloadManager.enqueue(createStrongSidecarDownloadPlan(strongVersionId, availability.status))
      return
    }

    const item = createBibleDownloadItem(version.id)
    downloadManager.enqueue([item])
  }

  React.useEffect(() => {
    if (shareFn) {
      shareFn(() => {
        queryClient.setQueryData(
          getVersionDownloadQueryKey(version.id, isOnboardingCompleted, installedVersionsSignal),
          true
        )
        void startDownload()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboardingCompleted, installedVersionsSignal, queryClient, shareFn, version.id])

  React.useEffect(() => {
    if (requiresStrong) {
      setStrongIndexAvailable(strongSelectionAvailability?.status === 'available')
    }
  }, [requiresStrong, strongSelectionAvailability?.status])

  // Watch for Bible-only download completion
  React.useEffect(() => {
    const previousStatus = previousBibleDownloadStatusRef.current
    previousBibleDownloadStatusRef.current = queueState?.status

    if (!requiresStrong && previousStatus !== 'completed' && queueState?.status === 'completed') {
      queryClient.setQueryData(
        getVersionDownloadQueryKey(version.id, isOnboardingCompleted, installedVersionsSignal),
        false
      )
      onDownloadComplete?.(version.id)
    }
  }, [
    onDownloadComplete,
    queryClient,
    queueState?.status,
    requiresStrong,
    version.id,
    installedVersionsSignal,
    isOnboardingCompleted,
  ])

  React.useEffect(() => {
    setStrongIndexExpanded(false)
    setInterlinearIndexExpanded(false)
  }, [strongCollapseKey])

  const updateVersion = async () => {
    await startDownload()
  }

  const deleteVersion = async () => {
    const jotaiStore = getDefaultStore()
    const bibleOfflineCopyId = createOfflineCopyId({
      kind: 'bible',
      versionId: version.id,
    })
    await deleteDownloadedItem(createDownloadedItemDeletionPlan(bibleOfflineCopyId))
    queryClient.setQueryData(
      getVersionDownloadQueryKey(version.id, isOnboardingCompleted, installedVersionsSignal),
      true
    )

    jotaiStore.set(installedVersionsSignalAtom, (c: number) => c + 1)
    // Trigger BibleViewer instances to reload so tabs that were showing
    // this version updates (e.g. shows the BIBLE_NOT_FOUND error view).
    jotaiStore.set(bibleDataRefreshSignalAtom, (c: number) => c + 1)
  }

  const confirmDelete = () => {
    Alert.alert(t('Attention'), t('Etes-vous vraiment sur de supprimer cette version ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: deleteVersion,
        style: 'destructive',
      },
    ])
  }

  const renderSelectionCheckbox = (disabled?: boolean) => {
    if (!showSelectionCheckbox) {
      return null
    }

    return (
      <ActionColumn opacity={disabled ? 0.45 : 1}>
        <Checkbox checked={Boolean(isSelected)} variant="icon" size={22} />
      </ActionColumn>
    )
  }

  const renderSelectedIndicator = () => (
    <ActionColumn>
      {isSelected && (
        <Box width={22} height={22} borderRadius={11} bg="primary" center>
          <FeatherIcon name="check" size={14} color="white" />
        </Box>
      )}
    </ActionColumn>
  )

  const interlinearIndexItems = showInterlinearCapability ? (
    <>
      <InterlinearIndexSelectorItem
        locale="fr"
        expanded={isInterlinearIndexExpanded}
        onAvailabilityChange={setFrenchInterlinearIndexAvailable}
      />
      <InterlinearIndexSelectorItem
        locale="en"
        expanded={isInterlinearIndexExpanded}
        onAvailabilityChange={setEnglishInterlinearIndexAvailable}
      />
    </>
  ) : null

  const selectionNeedsDownload = requiresStrong
    ? strongSelectionAvailability
      ? strongSelectionAvailability.status !== 'available'
      : undefined
    : versionNeedsDownload

  if (onOpenOfflineDetails) {
    return (
      <VersionItemContainer needsUpdate={needsUpdate} selected={isSelected}>
        <Box flex row alignItems="center">
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => onChange?.(version.id)}
            accessibilityRole={showSelectionCheckbox ? 'checkbox' : 'button'}
            accessibilityLabel={`${t('Sélectionner les versions')}: ${version.displayName || version.name}`}
            accessibilityState={
              showSelectionCheckbox ? { checked: Boolean(isSelected) } : undefined
            }
          >
            <Box flex row alignItems="center">
              {renderSelectionCheckbox()}
              <VersionIdentity
                version={version}
                color={versionColor}
                showPublicationDetails
                showCapabilities
                passiveCapabilities
                copyrightOpacity={copyrightOpacity}
                showStrongCapability={showStrongCapability}
                isStrongIndexAvailable={isSelected}
                showInterlinearCapability={showInterlinearCapability}
              />
              {isLoading ? (
                <Box width={30} center>
                  <Progress progress={Math.max(downloadProgress, 0.04)} size={22} thickness={2.5} />
                </Box>
              ) : versionNeedsDownload === false ? (
                <Box width={30} height={28} center position="relative" overflow="visible">
                  <FeatherIcon name="cloud" size={18} color="primary" />
                  {strongPresent && (
                    <Box
                      position="absolute"
                      right={-1}
                      bottom={-2}
                      size={14}
                      borderRadius={7}
                      bg="primary"
                      center
                    >
                      <Text
                        color="reverse"
                        fontSize={9}
                        bold
                        style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
                      >
                        S
                      </Text>
                    </Box>
                  )}
                </Box>
              ) : null}
            </Box>
          </TouchableOpacity>
          <ActionButton
            accessibilityLabel={t('bibleOfflineDetails.manage', { bible: version.id })}
            onPress={() => {
              void openOfflineDetails()
            }}
          >
            <FeatherIcon name="more-horizontal" size={20} color="default" />
          </ActionButton>
        </Box>
      </VersionItemContainer>
    )
  }

  if (selectionNeedsDownload !== false) {
    return (
      <Box>
        <VersionItemContainer
          onPress={() => onChange?.(version.id)}
          hasDependency={
            (showStrongCapability && isStrongIndexExpanded) ||
            (showInterlinearCapability && isInterlinearIndexExpanded)
          }
        >
          <Box flex row alignItems="center">
            <Box flex>
              <VersionIdentity
                version={version}
                color="default"
                showPublicationDetails
                showCapabilities
                copyrightColor={copyrightColor}
                copyrightOpacity={copyrightOpacity}
                copyrightStyle={copyrightStyle}
                onCopyrightPress={version.sourceUrl ? openSourceUrl : undefined}
                showStrongCapability={showStrongCapability}
                isStrongIndexAvailable={isStrongIndexAvailable}
                isStrongIndexExpanded={isStrongIndexExpanded}
                onToggleStrongIndex={
                  showStrongIndex && showStrongCapability ? toggleStrongIndex : undefined
                }
                strongToggleLabel={strongToggleLabel}
                strongAttribution={
                  strongVersionId ? t(getStrongBibleAttributionKey(strongVersionId)) : undefined
                }
                showInterlinearCapability={showInterlinearCapability}
                isInterlinearIndexAvailable={isInterlinearIndexAvailable}
                isInterlinearIndexExpanded={isInterlinearIndexExpanded}
                onToggleInterlinearIndex={
                  showInterlinearCapability ? toggleInterlinearIndex : undefined
                }
                interlinearToggleLabel={interlinearToggleLabel}
                interlinearAttribution={t('versionSelector.interlinearAttribution')}
              />
            </Box>
            {selectionNeedsDownload === true && !isLoading && !isQueued && (
              <ActionButton
                disabled={!isConnected}
                onPress={() => {
                  void startDownload()
                }}
              >
                <FeatherIcon name={isConnected ? 'download-cloud' : 'wifi-off'} size={16} />
              </ActionButton>
            )}
            {(versionAvailabilityQuery.isError || strongSelectionQuery.isError) && (
              <ActionButton
                onPress={() => {
                  void versionAvailabilityQuery.refetch()
                  void strongSelectionQuery.refetch()
                }}
              >
                <FeatherIcon name="rotate-cw" size={16} />
              </ActionButton>
            )}
            {renderSelectionCheckbox()}
            {typeof selectionNeedsDownload === 'undefined' &&
              !versionAvailabilityQuery.isError &&
              !strongSelectionQuery.isError && (
                <ActionColumn>
                  <FeatherIcon name="clock" size={18} color="tertiary" />
                </ActionColumn>
              )}
            {isQueued && (
              <ActionColumn>
                <FeatherIcon name="clock" size={18} color="tertiary" />
              </ActionColumn>
            )}
            {isLoading && (
              <ActionColumn>
                <Progress progress={Math.max(downloadProgress, 0.04)} size={22} thickness={2.5} />
              </ActionColumn>
            )}
          </Box>
        </VersionItemContainer>
        {showStrongIndex && showStrongCapability && strongVersionId && (
          <StrongIndexSelectorItem
            versionId={strongVersionId}
            expanded={isStrongIndexExpanded}
            onAvailabilityChange={setStrongIndexAvailable}
          />
        )}
        {interlinearIndexItems}
      </Box>
    )
  }

  if (isParameters) {
    return (
      <VersionItemContainer needsUpdate={needsUpdate}>
        <Box flex row center>
          <VersionIdentity version={version} color="default" />
          {needsUpdate ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !isConnected }}
              disabled={!isConnected}
              onPress={updateVersion}
              style={{ padding: 10 }}
            >
              <FeatherIcon
                name={isConnected ? 'download' : 'wifi-off'}
                size={18}
                color={isConnected ? 'success' : 'tertiary'}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={confirmDelete} style={{ padding: 10 }}>
              <FeatherIcon name="trash-2" size={18} color="quart" />
            </TouchableOpacity>
          )}
        </Box>
      </VersionItemContainer>
    )
  }

  return (
    <Box>
      <VersionItemContainer
        needsUpdate={needsUpdate}
        hasDependency={
          (showStrongCapability && isStrongIndexExpanded) ||
          (showInterlinearCapability && isInterlinearIndexExpanded)
        }
        onPress={() => onChange && onChange(version.id)}
      >
        <Box flex row alignItems="center">
          <VersionIdentity
            version={version}
            color={versionColor}
            showPublicationDetails
            showCapabilities
            copyrightColor={copyrightColor}
            copyrightOpacity={copyrightOpacity}
            copyrightStyle={copyrightStyle}
            onCopyrightPress={version.sourceUrl ? openSourceUrl : undefined}
            showStrongCapability={showStrongCapability}
            isStrongIndexAvailable={isStrongIndexAvailable}
            isStrongIndexExpanded={isStrongIndexExpanded}
            onToggleStrongIndex={
              showStrongIndex && showStrongCapability ? toggleStrongIndex : undefined
            }
            strongToggleLabel={strongToggleLabel}
            strongAttribution={
              strongVersionId ? t(getStrongBibleAttributionKey(strongVersionId)) : undefined
            }
            showInterlinearCapability={showInterlinearCapability}
            isInterlinearIndexAvailable={isInterlinearIndexAvailable}
            isInterlinearIndexExpanded={isInterlinearIndexExpanded}
            onToggleInterlinearIndex={
              showInterlinearCapability ? toggleInterlinearIndex : undefined
            }
            interlinearToggleLabel={interlinearToggleLabel}
            interlinearAttribution={t('versionSelector.interlinearAttribution')}
          />
          {renderSelectionCheckbox()}
          {!showSelectionCheckbox && renderSelectedIndicator()}
        </Box>
      </VersionItemContainer>
      {showStrongIndex && showStrongCapability && strongVersionId && (
        <StrongIndexSelectorItem
          versionId={strongVersionId}
          expanded={isStrongIndexExpanded}
          onAvailabilityChange={setStrongIndexAvailable}
        />
      )}
      {interlinearIndexItems}
    </Box>
  )
}

export default VersionSelectorItem
