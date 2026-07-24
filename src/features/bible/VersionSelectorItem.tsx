import * as FileSystem from 'expo-file-system/legacy'
import React from 'react'
import { Alert, Linking, TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { dbManager } from '~helpers/sqlite'

import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Progress from '~common/ui/Progress'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { getIfVersionNeedsDownload, isStrongVersion, Version } from '~helpers/bibleVersions'
import { isVersionInstalled, removeBibleVersion } from '~helpers/biblesDb'
import { requireBiblePath } from '~helpers/requireBiblePath'
import { deleteRedWordsFile } from '~helpers/redWords'
import { deletePericopeFile } from '~helpers/pericopes'
import useLanguage from '~helpers/useLanguage'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { installedVersionsSignalAtom, bibleDataRefreshSignalAtom } from '~state/app'
import { downloadManager } from '~helpers/downloadManager'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { RootState } from '~redux/modules/reducer'
import { setDefaultBibleVersion, setVersionUpdated } from '~redux/modules/user'
import { VersionCode, tabsAtom, BibleTab } from 'src/state/tabs'
import { store } from '~redux/store'
import { isStrongCapableBibleVersion } from '~helpers/strongBiblePublications'
import StrongIndexSelectorItem from './StrongIndexSelectorItem'
import StrongMark from './StrongMark'

const VersionItemContainer = ({
  children,
  needsUpdate,
  hasDependency,
  onPress,
}: React.PropsWithChildren<{
  needsUpdate?: boolean
  hasDependency?: boolean
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
      borderLeftWidth={needsUpdate ? 5 : 0}
      borderLeftColor={needsUpdate ? 'success' : undefined}
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

const ActionButton = ({ children, onPress }: React.PropsWithChildren<{ onPress: () => void }>) => (
  <TouchableOpacity onPress={onPress}>
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
        (!isStrongIndexAvailable && onToggleStrongIndex ? (
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
                <StrongMark highlighted={false} />
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
            <StrongMark highlighted={isStrongIndexAvailable} />
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
    {showPublicationDetails && isStrongIndexAvailable && strongAttribution && (
      <Text color={color} fontSize={10} opacity={0.5}>
        {strongAttribution}
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
  onDownloadComplete?: (id: VersionCode) => void
  showSelectionCheckbox?: boolean
  showStrongIndex?: boolean
  strongCollapseKey?: number
}

const VersionSelectorItem = ({
  version,
  isSelected,
  onChange,
  isParameters,
  shareFn,
  onDownloadComplete,
  showSelectionCheckbox,
  showStrongIndex,
  strongCollapseKey,
}: Props) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const [versionNeedsDownload, setVersionNeedsDownload] = React.useState<boolean>()
  const [isStrongIndexAvailable, setStrongIndexAvailable] = React.useState<boolean>()
  const [isStrongIndexExpanded, setStrongIndexExpanded] = React.useState(false)
  const needsUpdate = useSelector((state: RootState) => state.user.needsUpdate[version.id])
  const dispatch = useDispatch()
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)
  const installedVersionsSignal = useAtomValue(installedVersionsSignalAtom)

  // Subscribe to download queue state for this item
  const itemId = `bible:${version.id}`
  const queueState = useDownloadItemStatus(itemId)
  const isLoading = queueState?.status === 'downloading' || queueState?.status === 'inserting'
  const isQueued = queueState?.status === 'queued'
  const downloadProgress = queueState?.downloadProgress ?? 0
  const strongVersionId = isStrongCapableBibleVersion(version.id) ? version.id : undefined
  const showStrongCapability = showStrongIndex && Boolean(strongVersionId)
  const showStrongDependency = showStrongCapability && !isStrongIndexAvailable
  const toggleStrongIndex = () => setStrongIndexExpanded(expanded => !expanded)
  const strongToggleLabel = isStrongIndexExpanded
    ? t('versionSelector.hideStrongIndex', { bible: version.id })
    : t('versionSelector.showStrongIndex', { bible: version.id })
  const openSourceUrl = () => {
    if (version.sourceUrl) {
      Linking.openURL(version.sourceUrl)
    }
  }

  const versionColor = isSelected ? 'primary' : 'default'
  const copyrightColor = version.sourceUrl ? 'primary' : versionColor
  const copyrightOpacity = version.sourceUrl ? 0.75 : 0.5
  const copyrightStyle = version.sourceUrl
    ? { textDecorationLine: 'underline' as const }
    : undefined

  const startDownload = () => {
    const item = createBibleDownloadItem(version.id)
    downloadManager.enqueue([item])
  }

  React.useEffect(() => {
    ;(async () => {
      if (shareFn && !isStrongVersion(version.id)) {
        shareFn(() => {
          setVersionNeedsDownload(true)
          startDownload()
        })
      }

      const v = await getIfVersionNeedsDownload(version.id)
      setVersionNeedsDownload(v)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboardingCompleted, installedVersionsSignal])

  // Watch for download completion
  React.useEffect(() => {
    if (queueState?.status === 'completed') {
      setVersionNeedsDownload(false)
      if (onDownloadComplete) {
        onDownloadComplete(version.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueState?.status])

  React.useEffect(() => {
    setStrongIndexExpanded(false)
  }, [strongCollapseKey])

  React.useEffect(() => {
    if (isStrongIndexAvailable) setStrongIndexExpanded(false)
  }, [isStrongIndexAvailable])

  const updateVersion = async () => {
    await deleteVersion()
    startDownload()
    dispatch(setVersionUpdated(version.id))
  }

  const deleteVersion = async () => {
    // Check if we're deleting the default Bible version
    const state = store.getState()
    const defaultVersion = state.user.bible.settings.defaultBibleVersion
    const fallback: VersionCode = getDefaultBibleVersion(lang)

    if (version.id === defaultVersion) {
      dispatch(setDefaultBibleVersion(fallback))
    }

    // Update all tabs that use this version
    const jotaiStore = getDefaultStore()
    const tabs = jotaiStore.get(tabsAtom)
    const updatedTabs = tabs.map(tab => {
      if (tab.type !== 'bible') return tab

      const bibleTab = tab as BibleTab
      let tabNeedsUpdate = false
      let newSelectedVersion = bibleTab.data.selectedVersion
      let newParallelVersions = bibleTab.data.parallelVersions

      if (bibleTab.data.selectedVersion === version.id) {
        newSelectedVersion = fallback
        tabNeedsUpdate = true
      }

      if (bibleTab.data.parallelVersions.includes(version.id)) {
        newParallelVersions = bibleTab.data.parallelVersions.filter(v => v !== version.id)
        tabNeedsUpdate = true
      }

      if (tabNeedsUpdate) {
        return {
          ...bibleTab,
          data: {
            ...bibleTab.data,
            selectedVersion: newSelectedVersion,
            parallelVersions: newParallelVersions,
          },
        }
      }

      return tab
    })

    if (JSON.stringify(tabs) !== JSON.stringify(updatedTabs)) {
      jotaiStore.set(tabsAtom, updatedTabs)
    }

    if (isStrongVersion(version.id)) {
      const path = requireBiblePath(version.id)
      const file = await FileSystem.getInfoAsync(path)
      if (file.exists) {
        await FileSystem.deleteAsync(file.uri)
      }
      if (version.id === 'INT' || version.id === 'INT_EN') {
        const vLang = version.id === 'INT' ? 'fr' : 'en'
        dbManager.getDB('INTERLINEAIRE', vLang).delete()
      }
    } else {
      const installed = await isVersionInstalled(version.id)
      if (installed) {
        await removeBibleVersion(version.id)
      }
      const legacyPath = `${FileSystem.documentDirectory}bible-${version.id}.json`
      const legacyFile = await FileSystem.getInfoAsync(legacyPath)
      if (legacyFile.exists) {
        await FileSystem.deleteAsync(legacyFile.uri)
      }
    }

    deleteRedWordsFile(version.id)
    deletePericopeFile(version.id)
    setVersionNeedsDownload(true)

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

  if (
    typeof versionNeedsDownload === 'undefined' ||
    (isParameters && version.id === 'LSGS') ||
    (isParameters && version.id === 'KJVS')
  ) {
    return null
  }

  if (versionNeedsDownload) {
    return (
      <Box>
        <VersionItemContainer hasDependency={showStrongDependency && isStrongIndexExpanded}>
          <Box flex row alignItems="center">
            <Box disabled flex>
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
                onToggleStrongIndex={showStrongDependency ? toggleStrongIndex : undefined}
                strongToggleLabel={strongToggleLabel}
                strongAttribution={t('versionSelector.strongAttribution')}
              />
            </Box>
            {!isLoading && !isQueued && version.id !== 'LSGS' && version.id !== 'KJVS' && (
              <ActionButton onPress={startDownload}>
                <FeatherIcon name="download-cloud" size={16} />
              </ActionButton>
            )}
            {!isLoading &&
              !isQueued &&
              (version.id === 'LSGS' || version.id === 'KJVS') &&
              !showSelectionCheckbox && <ActionColumn />}
            {renderSelectionCheckbox(true)}
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
        {showStrongCapability && strongVersionId && (
          <StrongIndexSelectorItem
            versionId={strongVersionId}
            expanded={isStrongIndexExpanded}
            onAvailabilityChange={setStrongIndexAvailable}
          />
        )}
      </Box>
    )
  }

  if (isParameters) {
    return (
      <VersionItemContainer needsUpdate={needsUpdate}>
        <Box flex row center>
          <VersionIdentity version={version} color="default" />
          {needsUpdate ? (
            <TouchableOpacity onPress={updateVersion} style={{ padding: 10 }}>
              <FeatherIcon name="download" size={18} color="success" />
            </TouchableOpacity>
          ) : version.id !== getDefaultBibleVersion(lang) ? (
            <TouchableOpacity onPress={confirmDelete} style={{ padding: 10 }}>
              <FeatherIcon name="trash-2" size={18} color="quart" />
            </TouchableOpacity>
          ) : null}
        </Box>
      </VersionItemContainer>
    )
  }

  return (
    <Box>
      <VersionItemContainer
        needsUpdate={needsUpdate}
        hasDependency={showStrongDependency && isStrongIndexExpanded}
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
            onToggleStrongIndex={showStrongDependency ? toggleStrongIndex : undefined}
            strongToggleLabel={strongToggleLabel}
            strongAttribution={t('versionSelector.strongAttribution')}
          />
          {renderSelectionCheckbox()}
          {!showSelectionCheckbox && renderSelectedIndicator()}
        </Box>
      </VersionItemContainer>
      {showStrongCapability && strongVersionId && (
        <StrongIndexSelectorItem
          versionId={strongVersionId}
          expanded={isStrongIndexExpanded}
          onAvailabilityChange={setStrongIndexAvailable}
        />
      )}
    </Box>
  )
}

export default VersionSelectorItem
