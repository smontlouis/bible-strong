import { Feather } from '@expo/vector-icons'
import { useAtom, useSetAtom } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { isLocalResourceAvailable } from '~features/resources/resourceAvailability'
import useLanguage from '~helpers/useLanguage'
import {
  createDownloadItemFromOnboardingSelection,
  getOnboardingResourceIdentity,
  getOnboardingResourceSelectionId,
} from './onboardingResources'
import {
  getDefaultOfflineSetupFolderOptionIds,
  getOfflineSetupFolderSections,
  resolveOfflineSetupFolderOptionIds,
  toggleOfflineSetupOptionId,
  type OfflineSetupFolderOptionIds,
  type OfflineSetupOption,
  type OfflineSetupFolderId,
} from './offlineSetupPresets'
import OfflineResourceFolder from './components/OfflineResourceFolder'
import OfflineSetupFolderDetail, {
  type OfflineSetupFolderVisual,
} from './components/OfflineSetupFolderDetail'
import { isOnboardingCompletedAtom, selectedResourcesAtom } from './atom'
import formatResourceSize from './formatResourceSize'

type SelectResourcesProps =
  | {
      mode?: 'onboarding'
      setStep: React.Dispatch<React.SetStateAction<number>>
    }
  | {
      mode: 'preview'
      onClose: () => void
    }

type FolderVisual = OfflineSetupFolderVisual & {
  id: OfflineSetupFolderId
}

const FOLDER_VISUALS: FolderVisual[] = [
  {
    id: 'read-bible',
    icon: 'book-open',
    colors: { back: '#C9DAFF', frontStart: '#76A0FA', frontEnd: '#5983F0', icon: '#5983F0' },
  },
  {
    id: 'understand-words',
    icon: 'type',
    colors: { back: '#E0C8F8', frontStart: '#B578EE', frontEnd: '#9654D8', icon: '#9654D8' },
  },
  {
    id: 'explore-bible',
    icon: 'share-2',
    colors: { back: '#FAD9A8', frontStart: '#F8B663', frontEnd: '#EE9D39', icon: '#D97D18' },
  },
  {
    id: 'original-languages',
    icon: 'globe',
    colors: { back: '#F7C7D1', frontStart: '#EB879C', frontEnd: '#DD617C', icon: '#D84D6D' },
  },
]

const SelectResources = (props: SelectResourcesProps) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [, setSelectedResources] = useAtom(selectedResourcesAtom)
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const [folderOptionIds, setFolderOptionIds] = useState<OfflineSetupFolderOptionIds>(() =>
    getDefaultOfflineSetupFolderOptionIds(lang)
  )
  const [activeFolder, setActiveFolder] = useState<OfflineSetupFolderId>()
  const [draftOptionIds, setDraftOptionIds] = useState<string[]>([])
  const [installedBytes, setInstalledBytes] = useState(0)
  const [availableSelectionIds, setAvailableSelectionIds] = useState<Set<string>>(new Set())
  const [checkedSelectionKey, setCheckedSelectionKey] = useState<string>()
  const contentWidth = Math.min(350, width - 40)
  const folderOptionIdsKey = JSON.stringify(folderOptionIds)
  const selections = resolveOfflineSetupFolderOptionIds(folderOptionIds, lang)
  const missingSelections = selections.filter(
    selection => !availableSelectionIds.has(getOnboardingResourceSelectionId(selection))
  )
  const downloadBytes = missingSelections.reduce(
    (total, selection) =>
      total + createDownloadItemFromOnboardingSelection(selection).estimatedSize,
    0
  )

  useEffect(() => {
    let cancelled = false
    const currentSelections = resolveOfflineSetupFolderOptionIds(
      JSON.parse(folderOptionIdsKey) as OfflineSetupFolderOptionIds,
      lang
    )

    Promise.all(
      currentSelections.map(async selection => ({
        selection,
        available: await isLocalResourceAvailable(getOnboardingResourceIdentity(selection)),
      }))
    )
      .then(results => {
        if (cancelled) return
        const availability = results.reduce(
          (summary, result) => {
            if (!result.available) return summary
            summary.ids.add(getOnboardingResourceSelectionId(result.selection))
            summary.bytes += createDownloadItemFromOnboardingSelection(
              result.selection
            ).estimatedSize
            return summary
          },
          { bytes: 0, ids: new Set<string>() }
        )
        setInstalledBytes(availability.bytes)
        setAvailableSelectionIds(availability.ids)
        setCheckedSelectionKey(folderOptionIdsKey)
      })
      .catch(() => {
        if (!cancelled) {
          setInstalledBytes(0)
          setAvailableSelectionIds(new Set())
          setCheckedSelectionKey(folderOptionIdsKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [folderOptionIdsKey, lang])

  const openFolder = (folderId: OfflineSetupFolderId) => {
    setDraftOptionIds(folderOptionIds[folderId])
    setActiveFolder(folderId)
  }

  const toggleDraftOption = (option: OfflineSetupOption) => {
    const folderOptions = activeFolder
      ? getOfflineSetupFolderSections(activeFolder, lang).flatMap(section => section.options)
      : []
    setDraftOptionIds(current => toggleOfflineSetupOptionId(current, option, folderOptions))
  }

  const saveActiveFolder = () => {
    if (!activeFolder) return
    setFolderOptionIds(current => ({ ...current, [activeFolder]: draftOptionIds }))
    setActiveFolder(undefined)
  }

  const continueToDownloads = () => {
    if (checkedSelectionKey !== folderOptionIdsKey) return
    if (props.mode === 'preview') {
      props.onClose()
      return
    }
    if (missingSelections.length === 0) {
      setIsOnboardingCompleted(true)
      return
    }
    setSelectedResources(missingSelections)
    props.setStep(2)
  }

  const renderManifest = () => (
    <Box
      mx={20}
      mb={Math.max(insets.bottom, 16)}
      px={14}
      pt={18}
      pb={12}
      borderRadius={36}
      bg="#172840"
      style={{ boxShadow: '0 8px 22px rgba(28,51,88,0.18)' }}
    >
      <HStack alignItems="center" px={12} gap={14}>
        <Box size={36} borderRadius={18} bg="#5983F0" center>
          <Feather name="archive" size={20} color="#FFFFFF" />
        </Box>
        <Box flex>
          <Text color="#B8C2D1" fontSize={11}>
            {t('offlineSetup.toDownload')}
          </Text>
          <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
            {formatResourceSize(downloadBytes, lang)}
          </Text>
        </Box>
        <Box height={34} width={1} bg="rgba(255,255,255,0.24)" />
        <Box flex>
          <Text color="#B8C2D1" fontSize={11}>
            {t('offlineSetup.onDevice')}
          </Text>
          <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
            {formatResourceSize(installedBytes, lang)}
          </Text>
        </Box>
      </HStack>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          props.mode === 'preview' ? 'offlineSetup.closePreview' : 'offlineSetup.continue'
        )}
        disabled={selections.length === 0 || checkedSelectionKey !== folderOptionIdsKey}
        onPress={continueToDownloads}
        style={({ pressed }) => ({
          opacity:
            selections.length === 0 || checkedSelectionKey !== folderOptionIdsKey
              ? 0.45
              : pressed
                ? 0.82
                : 1,
        })}
      >
        <Box height={56} mt={16} borderRadius={28} bg="#5983F0" center row gap={12}>
          <Text color="#FFFFFF" title fontSize={16}>
            {t(props.mode === 'preview' ? 'offlineSetup.closePreview' : 'offlineSetup.continue')}
          </Text>
          <Feather
            name={props.mode === 'preview' ? 'x' : 'arrow-right'}
            size={22}
            color="#FFFFFF"
          />
        </Box>
      </Pressable>
    </Box>
  )

  if (activeFolder) {
    const visual = FOLDER_VISUALS.find(item => item.id === activeFolder)!
    return (
      <OfflineSetupFolderDetail
        folderId={activeFolder}
        lang={lang}
        sections={getOfflineSetupFolderSections(activeFolder, lang)}
        selectedOptionIds={draftOptionIds}
        visual={visual}
        onBack={() => setActiveFolder(undefined)}
        onToggleOption={toggleDraftOption}
        onSave={saveActiveFolder}
      />
    )
  }

  return (
    <Box flex bg="#F4F7FF" pt={insets.top}>
      {props.mode === 'preview' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.closePreview')}
          onPress={props.onClose}
          hitSlop={10}
          style={{
            position: 'absolute',
            left: Math.max((width - contentWidth) / 2, 20),
            top: insets.top + 8,
            zIndex: 10,
          }}
        >
          <Box size={44} borderRadius={22} bg="#FFFFFF" center>
            <Feather name="arrow-left" size={21} color="#142033" />
          </Box>
        </Pressable>
      ) : null}
      <ScrollView
        contentContainerStyle={{ width: contentWidth, alignSelf: 'center', paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <Text title fontSize={40} lineHeight={42} mt={props.mode === 'preview' ? 76 : 26}>
          {t('offlineSetup.title')}
        </Text>
        <Text color="#68758C" fontSize={15} lineHeight={21} mt={10} mb={28}>
          {t('offlineSetup.subtitle')}
        </Text>

        <VStack gap={38}>
          {[0, 2].map(startIndex => (
            <HStack key={startIndex} gap={10}>
              {FOLDER_VISUALS.slice(startIndex, startIndex + 2).map(visual => {
                const count = folderOptionIds[visual.id].length
                return (
                  <OfflineResourceFolder
                    key={visual.id}
                    title={t(`offlineSetup.presets.${visual.id}.title`)}
                    subtitle={t(
                      visual.id === 'read-bible'
                        ? 'offlineSetup.translationCount'
                        : 'offlineSetup.selectedCount',
                      { count }
                    )}
                    icon={visual.icon}
                    selected={count > 0}
                    colors={visual.colors}
                    onPress={() => openFolder(visual.id)}
                  />
                )
              })}
            </HStack>
          ))}
        </VStack>
      </ScrollView>
      {renderManifest()}
    </Box>
  )
}

export default SelectResources
