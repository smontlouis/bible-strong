import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React, { useEffectEvent } from 'react'
import { Linking, Platform, TouchableOpacity } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { getDefaultStore } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import { ListSeparator } from '~common/ui/ListSection'
import Progress from '~common/ui/Progress'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { Version } from '~helpers/bibleVersions'
import { bibleDataRefreshSignalAtom } from '~state/app'
import { downloadManager } from '~helpers/downloadManager'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import {
  createBibleDownloadItem,
  createStrongSidecarDownloadPlan,
} from '~helpers/downloadItemFactory'
import { VersionCode } from 'src/state/tabs'
import { useOfflineResourceState } from '~features/resources/useOfflineResourceRegistry'
import { useStrongIndexLexiconModuleId } from '~features/resources/useStrongIndexLexicon'
import {
  getStrongBibleAttributionKey,
  isStrongCapableBibleVersion,
} from '~helpers/strongBiblePublications'
import type { StrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import StrongMark from './StrongMark'
import { isInterlinearCapableBibleVersion } from '~helpers/interlinearBiblePublications'
import InterlinearShortcut from './InterlinearShortcut'
import { getDownloadItemProgress } from '~state/downloadQueue'
import { useResourcePublicationStatus } from '~helpers/useResourcePublicationStatus'
import { getBibleRelatedPublicationResources } from '~helpers/bibleRelatedPublications'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import {
  createDownloadedItemDeletionPlan,
  deleteDownloadedItem,
} from '~helpers/deleteDownloadedItem'
import useConnection from '~helpers/useConnection'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { localQueryOptions } from '~helpers/queryOptions'
const ROW_PADDING_LEFT = 20
const CHECKBOX_SLOT = 48

const VersionItemContainer = ({
  children,
  needsUpdate,
  selected,
  separatorInset = ROW_PADDING_LEFT,
  onPress,
}: React.PropsWithChildren<{
  needsUpdate?: boolean
  selected?: boolean
  /** Where the hairline under the row starts: where its text starts. */
  separatorInset?: number
  onPress?: () => void
}>) => {
  const theme = useStylingTheme()
  const content = (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous min-h-[76px] pr-[4px] py-[12px]',
        needsUpdate && 'border-l-success'
      )}
      style={{
        paddingLeft: ROW_PADDING_LEFT,
        // An update waiting keeps its mark on the edge; the chosen version takes a tint.
        borderLeftWidth: needsUpdate ? 5 : 0,
        backgroundColor: selected ? colorWithOpacity(theme.colors.primary, 0.12) : undefined,
      }}
    >
      {children}
      <ListSeparator inset={separatorInset} overlay />
    </Box>
  )

  return onPress ? (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  ) : (
    content
  )
}

const ActionColumn = ({ children, opacity }: React.PropsWithChildren<{ opacity?: number }>) => (
  <Box
    className="overflow-hidden border-continuous w-[48px] min-h-[48px] items-center justify-center"
    style={{ opacity: opacity }}
  >
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
  highlightStrong,
  strongAttribution,
  showInterlinearCapability,
  interlinearAttribution,
  interlinearShortcut,
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
  /** The S follows the selected row's colour; it says nothing of an Offline copy. */
  highlightStrong?: boolean
  strongAttribution?: string
  showInterlinearCapability?: boolean
  interlinearAttribution?: string
  /** Opens the version straight in interlinear, under the line that says it can. */
  interlinearShortcut?: React.ReactNode
}) => {
  const { t } = useTranslation()
  const stylingTheme = useStylingTheme()
  return (
    // Visible overflow: the interlinear button's shadow goes past the column
    <Box className="overflow-visible border-continuous flex-[1]">
      <Text
        className="text-[12px] opacity-[0.5] font-bold"
        style={{ color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default }}
      >
        {version.id}
      </Text>
      <HStack className="items-center">
        <Text
          className="text-[16px]"
          style={{ color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default }}
        >
          {version.displayName || version.name}
        </Text>
        {showCapabilities && version.hasAudio && (
          <Box className="overflow-hidden border-continuous ml-[4px]">
            <FeatherIcon name="volume-2" size={16} color="primary" />
          </Box>
        )}
        {showCapabilities && showStrongCapability && (
          <Box className="overflow-hidden border-continuous ml-[5px]">
            <StrongMark highlighted={highlightStrong} passive />
          </Box>
        )}
      </HStack>
      {showCapabilities && showInterlinearCapability && (
        <Text className="text-[13px] leading-[18px] text-tertiary mt-[2px]">
          {t('versionSelector.interlinearDescription')}
        </Text>
      )}
      {showPublicationDetails && (
        <Text
          className="text-[10px]"
          onPress={onCopyrightPress}
          style={[
            {
              color: resolveThemeColor(stylingTheme, copyrightColor) || stylingTheme.colors.default,
              opacity: copyrightOpacity,
            },
            copyrightStyle,
          ]}
        >
          {version.c}
        </Text>
      )}
      {showPublicationDetails && strongAttribution && (
        <Text
          className="text-[10px] opacity-[0.5]"
          style={{ color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default }}
        >
          {strongAttribution}
        </Text>
      )}
      {showPublicationDetails && interlinearAttribution && (
        <Text
          className="text-[10px] opacity-[0.5]"
          style={{ color: resolveThemeColor(stylingTheme, color) || stylingTheme.colors.default }}
        >
          {interlinearAttribution}
        </Text>
      )}
      {showCapabilities && showInterlinearCapability && interlinearShortcut && (
        <Box className="overflow-visible border-continuous mt-[10px] mb-[6px]">
          {interlinearShortcut}
        </Box>
      )}
    </Box>
  )
}

export interface Props {
  version: Version & { displayName?: string }
  isSelected?: boolean
  onChange?: (id: VersionCode) => void
  isParameters?: boolean
  shareFn?: (fn: () => void) => void
  onDownloadStart?: (id: VersionCode) => void
  onDownloadComplete?: (id: VersionCode) => void
  showSelectionCheckbox?: boolean
  showStrongIndex?: boolean
  selectionRequirement?: 'bible' | 'strong'
  onOpenOfflineDetails?: (version: Version & { displayName?: string }) => void
  /** Offers to open an interlinear-capable version straight in interlinear. */
  onOpenInterlinear?: (id: VersionCode) => void
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
  selectionRequirement = 'bible',
  onOpenOfflineDetails,
  onOpenInterlinear,
}: Props) => {
  const { t } = useTranslation()
  const confirmDeletion = useConfirmDialog()
  const isConnected = useConnection()
  const resources = useResourceAccess()

  // Subscribe to download queue state for this item
  const itemId = createOfflineCopyId({ kind: 'bible', versionId: version.id })
  const offlineResourceState = useOfflineResourceState(itemId)
  const queueState = useDownloadItemStatus(itemId)
  const previousBibleDownloadStatusRef = React.useRef(queueState?.status)
  const strongVersionId = isStrongCapableBibleVersion(version.id) ? version.id : undefined
  const strongResourceState = useOfflineResourceState(
    strongVersionId
      ? createOfflineCopyId({ kind: 'strong-bible-index', versionId: strongVersionId })
      : undefined
  )
  const strongOfflineAvailability = strongResourceState?.availability as
    | StrongBibleSidecarAvailability
    | undefined
  const lexiconModuleId = useStrongIndexLexiconModuleId()
  const requiresStrong = selectionRequirement === 'strong' && Boolean(strongVersionId)
  const { data: strongUsageAvailability } = useQuery({
    queryKey: ['strong-selection-availability', strongVersionId, strongOfflineAvailability?.status],
    queryFn: () => resources.strongBible.getAvailability(strongVersionId!),
    enabled: requiresStrong,
    ...localQueryOptions,
  })
  const strongSelectionAvailability = requiresStrong
    ? strongUsageAvailability
    : strongOfflineAvailability
  const versionNeedsDownload = offlineResourceState
    ? offlineResourceState.availability.status !== 'available'
    : undefined
  const bibleDownloadItem = createBibleDownloadItem(version.id)
  const publicationStatus = useResourcePublicationStatus({
    resourceId: bibleDownloadItem.id,
    isInstalled: versionNeedsDownload === false,
    relatedResources: getBibleRelatedPublicationResources(version.id),
  })
  const needsUpdate = publicationStatus.status === 'update-available'
  const strongPresent =
    strongOfflineAvailability?.status === 'available' ||
    strongOfflineAvailability?.status === 'incompatible' ||
    strongOfflineAvailability?.status === 'corrupt'
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
  const showInterlinearCapability = showStrongIndex && isInterlinearCapableBibleVersion(version.id)
  const openSourceUrl = () => {
    if (version.sourceUrl) {
      Linking.openURL(version.sourceUrl)
    }
  }

  const openOfflineDetails = () => {
    if (!onOpenOfflineDetails) return
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
    if (requiresStrong && strongVersionId) {
      const availability = strongSelectionAvailability
      if (!availability) return
      onDownloadStart?.(version.id)
      downloadManager.enqueue(
        createStrongSidecarDownloadPlan(strongVersionId, availability.status, lexiconModuleId)
      )
      return
    }

    const item = createBibleDownloadItem(version.id)
    downloadManager.enqueue([item])
  }

  // The shared function keeps the download of the render that shared it.
  const getStartDownload = useEffectEvent(() => startDownload)
  React.useEffect(() => {
    if (shareFn) {
      const start = getStartDownload()
      shareFn(() => {
        void start()
      })
    }
  }, [shareFn, version.id])

  // Watch for Bible-only download completion
  React.useEffect(() => {
    const previousStatus = previousBibleDownloadStatusRef.current
    previousBibleDownloadStatusRef.current = queueState?.status

    if (!requiresStrong && previousStatus !== 'completed' && queueState?.status === 'completed') {
      onDownloadComplete?.(version.id)
    }
  }, [onDownloadComplete, queueState?.status, requiresStrong, version.id])

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

    // Trigger BibleViewer instances to reload so tabs that were showing
    // this version updates (e.g. shows the BIBLE_NOT_FOUND error view).
    jotaiStore.set(bibleDataRefreshSignalAtom, (c: number) => c + 1)
  }

  const confirmDelete = () => {
    void confirmDeletion({
      title: t('Attention'),
      message: t('Etes-vous vraiment sur de supprimer cette version ?'),
      cancelLabel: t('Non'),
      confirmLabel: t('Oui'),
      destructive: true,
    }).then(confirmed => {
      if (confirmed) return deleteVersion()
    })
  }

  const renderSelectionCheckbox = (disabled?: boolean) => {
    if (!showSelectionCheckbox) {
      return null
    }

    return (
      <ActionColumn opacity={disabled ? 0.45 : 1}>
        <Checkbox checked={Boolean(isSelected)} size={22} />
      </ActionColumn>
    )
  }

  const renderSelectedIndicator = () => (
    <ActionColumn>
      {isSelected && (
        <Box className="overflow-hidden border-continuous w-[22px] h-[22px] rounded-full bg-primary items-center justify-center">
          <FeatherIcon name="check" size={14} color="white" />
        </Box>
      )}
    </ActionColumn>
  )

  const selectionNeedsDownload = requiresStrong
    ? strongSelectionAvailability
      ? strongSelectionAvailability.status !== 'available'
      : undefined
    : versionNeedsDownload
  const isUnavailableOffline = selectionNeedsDownload === true && !isConnected
  const interlinearShortcut =
    onOpenInterlinear && showInterlinearCapability && !isUnavailableOffline ? (
      <InterlinearShortcut onPress={() => onOpenInterlinear(version.id)} />
    ) : undefined

  if (onOpenOfflineDetails) {
    return (
      // With a checkbox, the box says a version is chosen: the row takes no tint.
      <VersionItemContainer
        needsUpdate={needsUpdate}
        selected={isSelected && !showSelectionCheckbox}
        separatorInset={showSelectionCheckbox ? ROW_PADDING_LEFT + CHECKBOX_SLOT : undefined}
      >
        <Box className="overflow-visible border-continuous flex-[1] flex-row items-center">
          <TouchableOpacity
            style={{ flex: 1 }}
            disabled={isUnavailableOffline}
            onPress={() => onChange?.(version.id)}
            accessibilityRole={showSelectionCheckbox ? 'checkbox' : 'button'}
            accessibilityLabel={`${t('Sélectionner les versions')}: ${version.displayName || version.name}`}
            accessibilityState={
              showSelectionCheckbox
                ? { checked: Boolean(isSelected), disabled: isUnavailableOffline }
                : { disabled: isUnavailableOffline }
            }
            // The row is one element for screen readers: its interlinear button becomes an action
            accessibilityActions={
              interlinearShortcut
                ? [{ name: 'openInterlinear', label: t('versionSelector.openInterlinear') }]
                : undefined
            }
            onAccessibilityAction={event => {
              if (event.nativeEvent.actionName === 'openInterlinear') {
                onOpenInterlinear?.(version.id)
              }
            }}
          >
            <Box
              className="overflow-visible border-continuous flex-[1] flex-row items-center"
              style={{ opacity: isUnavailableOffline ? 0.45 : 1 }}
            >
              {renderSelectionCheckbox()}
              <VersionIdentity
                version={version}
                color={versionColor}
                showPublicationDetails
                showCapabilities
                copyrightOpacity={copyrightOpacity}
                showStrongCapability={showStrongCapability}
                highlightStrong={isSelected}
                showInterlinearCapability={showInterlinearCapability}
                interlinearShortcut={interlinearShortcut}
              />
              {isLoading ? (
                <Box className="overflow-hidden border-continuous w-[30px] items-center justify-center">
                  <Progress progress={Math.max(downloadProgress, 0.04)} size={22} thickness={2.5} />
                </Box>
              ) : versionNeedsDownload === false ? (
                <Box className="border-continuous overflow-visible w-[30px] h-[28px] items-center justify-center relative">
                  <FeatherIcon name="cloud" size={18} color="primary" />
                  {strongPresent && (
                    <Box
                      className="overflow-hidden border-continuous absolute right-[-1px] bottom-[-2px] rounded-full bg-primary items-center justify-center"
                      style={{ width: 14, height: 14 }}
                    >
                      <Text
                        className="text-reverse text-[9px] font-bold"
                        style={{ fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' }}
                      >
                        S
                      </Text>
                    </Box>
                  )}
                </Box>
              ) : isUnavailableOffline ? (
                <Box className="overflow-hidden border-continuous w-[30px] h-[28px] items-center justify-center">
                  <FeatherIcon name="wifi-off" size={18} color="tertiary" />
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
      <VersionItemContainer
        onPress={isUnavailableOffline ? undefined : () => onChange?.(version.id)}
      >
        <Box
          className="overflow-hidden border-continuous flex-[1] flex-row items-center"
          style={{ opacity: isUnavailableOffline ? 0.45 : 1 }}
        >
          <Box className="overflow-hidden border-continuous flex-[1]">
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
              strongAttribution={
                strongVersionId ? t(getStrongBibleAttributionKey(strongVersionId)) : undefined
              }
              showInterlinearCapability={showInterlinearCapability}
              interlinearShortcut={interlinearShortcut}
              interlinearAttribution={
                isInterlinearCapableBibleVersion(version.id)
                  ? t('versionSelector.interlinearAttribution')
                  : undefined
              }
            />
          </Box>
          {selectionNeedsDownload === true && !isLoading && !isQueued && (
            <ActionButton
              accessibilityLabel={t('accessibility.downloadVersion', {
                version: version.displayName || version.name,
              })}
              disabled={!isConnected}
              onPress={() => {
                void startDownload()
              }}
            >
              <FeatherIcon name={isConnected ? 'download-cloud' : 'wifi-off'} size={16} />
            </ActionButton>
          )}
          {renderSelectionCheckbox()}
          {typeof selectionNeedsDownload === 'undefined' && (
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
    )
  }

  if (isParameters) {
    return (
      <VersionItemContainer needsUpdate={needsUpdate}>
        <Box className="overflow-hidden border-continuous flex-[1] flex-row items-center justify-center">
          <VersionIdentity version={version} color="default" />
          {needsUpdate ? (
            <TouchableOpacity
              accessibilityLabel={t('accessibility.updateVersion', {
                version: version.displayName || version.name,
              })}
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
            <TouchableOpacity
              accessibilityLabel={t('accessibility.deleteVersion', {
                version: version.displayName || version.name,
              })}
              accessibilityRole="button"
              onPress={confirmDelete}
              style={{ padding: 10 }}
            >
              <FeatherIcon name="trash-2" size={18} color="quart" />
            </TouchableOpacity>
          )}
        </Box>
      </VersionItemContainer>
    )
  }

  return (
    <VersionItemContainer
      needsUpdate={needsUpdate}
      onPress={() => onChange && onChange(version.id)}
    >
      <Box className="overflow-hidden border-continuous flex-[1] flex-row items-center">
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
          strongAttribution={
            strongVersionId ? t(getStrongBibleAttributionKey(strongVersionId)) : undefined
          }
          showInterlinearCapability={showInterlinearCapability}
          interlinearShortcut={interlinearShortcut}
          interlinearAttribution={
            isInterlinearCapableBibleVersion(version.id)
              ? t('versionSelector.interlinearAttribution')
              : undefined
          }
        />
        {renderSelectionCheckbox()}
        {!showSelectionCheckbox && renderSelectedIndicator()}
      </Box>
    </VersionItemContainer>
  )
}

export default VersionSelectorItem
