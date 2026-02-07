import * as Icon from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import React from 'react'
import { Alert, TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { dbManager } from '~helpers/sqlite'

import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { useAtomValue } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import Animated from 'react-native-reanimated'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
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
import { installedVersionsSignalAtom } from '~state/app'
import { downloadManager } from '~helpers/downloadManager'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createBibleDownloadItem } from '~helpers/downloadItemFactory'
import { RootState } from '~redux/modules/reducer'
import { setDefaultBibleVersion, setVersionUpdated } from '~redux/modules/user'
import { Theme } from '~themes'
import { VersionCode, tabsAtom, BibleTab } from 'src/state/tabs'
import { store } from '~redux/store'

const Container = styled.View(
  ({ needsUpdate, theme }: { needsUpdate?: boolean; theme: Theme }) => ({
    padding: 20,
    paddingTop: 10,
    paddingBottom: 10,
    ...(needsUpdate
      ? {
          borderLeftColor: theme.colors.success,
          borderLeftWidth: 5,
        }
      : {}),
  })
)

const TouchableContainer = Container.withComponent(TouchableOpacity)

const TextVersion = styled.Text(
  ({ isSelected, theme }: { isSelected?: boolean; theme: Theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 12,
    opacity: 0.5,
    fontWeight: 'bold',
  })
)

const TextCopyright = styled.Text(
  ({ isSelected, theme }: { isSelected?: boolean; theme: Theme }) => ({
    color: isSelected ? theme.colors.primary : theme.colors.default,
    fontSize: 10,
    backgroundColor: 'transparent',
    opacity: 0.5,
  })
)

const TextName = styled.Text(({ isSelected, theme }: { isSelected?: boolean; theme: Theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontSize: 16,
  backgroundColor: 'transparent',
}))

const DeleteIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.quart,
}))

const UpdateIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.success,
}))

interface Props {
  version: Version
  isSelected?: boolean
  onChange?: (id: VersionCode) => void
  isParameters?: boolean
  shareFn?: (fn: () => void) => void
  onDownloadComplete?: (id: VersionCode) => void
}

const VersionSelectorItem = ({
  version,
  isSelected,
  onChange,
  isParameters,
  shareFn,
  onDownloadComplete,
}: Props) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const theme: Theme = useTheme()
  const [versionNeedsDownload, setVersionNeedsDownload] = React.useState<boolean>()
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
        onDownloadComplete(version.id as VersionCode)
      }
    }
  }, [queueState?.status])

  const startDownload = () => {
    const item = createBibleDownloadItem(version.id)
    downloadManager.enqueue([item])
  }

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

      if (bibleTab.data.parallelVersions.includes(version.id as VersionCode)) {
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

  if (
    typeof versionNeedsDownload === 'undefined' ||
    (isParameters && version.id === 'LSGS') ||
    (isParameters && version.id === 'KJVS')
  ) {
    return null
  }

  if (versionNeedsDownload) {
    return (
      // @ts-ignore
      <Container>
        <Box flex row>
          <Box disabled flex>
            {/* @ts-ignore */}
            <TextVersion>{version.id}</TextVersion>
            <HStack alignItems="center">
              {/* @ts-ignore */}
              <TextName>{version.name}</TextName>
              {version?.hasAudio && (
                <Box>
                  <FeatherIcon name="volume-2" size={16} color="primary" />
                </Box>
              )}
            </HStack>
            {/* @ts-ignore */}
            <TextCopyright>{version.c}</TextCopyright>
          </Box>
          {!isLoading && !isQueued && version.id !== 'LSGS' && version.id !== 'KJVS' && (
            <TouchableOpacity
              onPress={startDownload}
              style={{ padding: 10, alignItems: 'flex-end' }}
            >
              <FeatherIcon name="download" size={20} />
              {(version.id === 'INT' || version.id === 'INT_EN') && (
                <Box center marginTop={5}>
                  <Text fontSize={10}>20Mo</Text>
                </Box>
              )}
            </TouchableOpacity>
          )}
          {isQueued && (
            <Box width={80} justifyContent="center" alignItems="flex-end" mr={10}>
              <FeatherIcon name="clock" size={18} color="tertiary" />
            </Box>
          )}
          {isLoading && (
            <Box width={80} justifyContent="center" alignItems="flex-end" mr={10}>
              <Box width={60} height={4} borderRadius={2} bg="border" overflow="hidden">
                <Animated.View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: theme.colors.primary,
                    width: `${Math.round(downloadProgress * 100)}%` as any,
                    transitionProperty: 'width',
                    transitionDuration: 150,
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Container>
    )
  }

  if (isParameters) {
    return (
      // @ts-ignore
      <Container needsUpdate={needsUpdate}>
        <Box flex row center>
          <Box flex>
            {/* @ts-ignore */}
            <TextVersion>{version.id}</TextVersion>
            {/* @ts-ignore */}
            <TextName>{version.name}</TextName>
          </Box>
          {needsUpdate ? (
            <TouchableOpacity onPress={updateVersion} style={{ padding: 10 }}>
              <UpdateIcon name="download" size={18} />
            </TouchableOpacity>
          ) : version.id !== getDefaultBibleVersion(lang) ? (
            <TouchableOpacity onPress={confirmDelete} style={{ padding: 10 }}>
              <DeleteIcon name="trash-2" size={18} />
            </TouchableOpacity>
          ) : null}
        </Box>
      </Container>
    )
  }

  return (
    // @ts-ignore
    <TouchableContainer
      needsUpdate={needsUpdate}
      // @ts-ignore
      onPress={() => onChange && onChange(version.id)}
    >
      <Box flex>
        {/* @ts-ignore */}
        <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
        <HStack alignItems="center">
          {/* @ts-ignore */}
          <TextName isSelected={isSelected}>{version.name}</TextName>
          {version?.hasAudio && (
            <Box>
              <FeatherIcon name="volume-2" size={16} color="primary" />
            </Box>
          )}
        </HStack>
        {/* @ts-ignore */}
        <TextCopyright>{version.c}</TextCopyright>
      </Box>
    </TouchableContainer>
  )
}

export default VersionSelectorItem
