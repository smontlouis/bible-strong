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
  getOfflineSetupPresetSelections,
  resolveOfflineSetupSelections,
  type OfflineSetupPresetId,
} from './offlineSetupPresets'
import OfflineResourceFolder from './components/OfflineResourceFolder'
import { isOnboardingCompletedAtom, selectedResourcesAtom } from './atom'

type SelectResourcesProps =
  | {
      mode?: 'onboarding'
      setStep: React.Dispatch<React.SetStateAction<number>>
    }
  | {
      mode: 'preview'
      onClose: () => void
    }

type PresetVisual = {
  id: OfflineSetupPresetId
  icon: React.ComponentProps<typeof Feather>['name']
  colors: {
    back: string
    frontStart: string
    frontEnd: string
    icon: string
  }
}

const PRESET_VISUALS: PresetVisual[] = [
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

const DETAIL_KEYS: Record<OfflineSetupPresetId, string[]> = {
  'read-bible': ['bible'],
  'understand-words': ['bible', 'strongIndex', 'strongLexicon', 'dictionary'],
  'explore-bible': [
    'nave',
    'crossReferences',
    'commentaries',
    'timeline',
    'strongFoundation',
    'entities',
  ],
  'original-languages': ['originalBible', 'interlinear', 'strongLexicon', 'greekDictionary'],
}

const formatMegabytes = (bytes: number, lang: string): string => {
  const value = bytes / 1_000_000
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value)} ${
    lang === 'fr' ? 'Mo' : 'MB'
  }`
}

const SelectResources = (props: SelectResourcesProps) => {
  const { t } = useTranslation()
  const lang = useLanguage()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const [, setSelectedResources] = useAtom(selectedResourcesAtom)
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const [selectedPresets, setSelectedPresets] = useState<Set<OfflineSetupPresetId>>(
    new Set(['read-bible'])
  )
  const [activePreset, setActivePreset] = useState<OfflineSetupPresetId>()
  const [installedBytes, setInstalledBytes] = useState(0)
  const [availableSelectionIds, setAvailableSelectionIds] = useState<Set<string>>(new Set())
  const [checkedSelectionKey, setCheckedSelectionKey] = useState<string>()
  const contentWidth = Math.min(350, width - 40)
  const selectedPresetKey = Array.from(selectedPresets).sort().join(',')
  const selections = resolveOfflineSetupSelections(selectedPresets, lang)
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
    const currentSelections = resolveOfflineSetupSelections(
      selectedPresetKey ? (selectedPresetKey.split(',') as OfflineSetupPresetId[]) : [],
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
        setInstalledBytes(
          results.reduce(
            (total, result) =>
              total +
              (result.available
                ? createDownloadItemFromOnboardingSelection(result.selection).estimatedSize
                : 0),
            0
          )
        )
        setAvailableSelectionIds(
          new Set(
            results
              .filter(result => result.available)
              .map(result => getOnboardingResourceSelectionId(result.selection))
          )
        )
        setCheckedSelectionKey(selectedPresetKey)
      })
      .catch(() => {
        if (!cancelled) {
          setInstalledBytes(0)
          setAvailableSelectionIds(new Set())
          setCheckedSelectionKey(selectedPresetKey)
        }
      })

    return () => {
      cancelled = true
    }
  }, [lang, selectedPresetKey])

  const togglePreset = (presetId: OfflineSetupPresetId) => {
    // The current production reader still requires its primary Bible locally.
    if (presetId === 'read-bible') return
    setSelectedPresets(current => {
      const next = new Set(current)
      if (next.has(presetId)) next.delete(presetId)
      else next.add(presetId)
      return next
    })
  }

  const continueToDownloads = () => {
    if (checkedSelectionKey !== selectedPresetKey) return
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
            {formatMegabytes(downloadBytes, lang)}
          </Text>
        </Box>
        <Box height={34} width={1} bg="rgba(255,255,255,0.24)" />
        <Box flex>
          <Text color="#B8C2D1" fontSize={11}>
            {t('offlineSetup.onDevice')}
          </Text>
          <Text color="#FFFFFF" fontSize={18} style={{ fontFamily: 'FiraCode' }}>
            {formatMegabytes(installedBytes, lang)}
          </Text>
        </Box>
      </HStack>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(
          props.mode === 'preview' ? 'offlineSetup.closePreview' : 'offlineSetup.continue'
        )}
        disabled={selections.length === 0 || checkedSelectionKey !== selectedPresetKey}
        onPress={continueToDownloads}
        style={({ pressed }) => ({
          opacity:
            selections.length === 0 || checkedSelectionKey !== selectedPresetKey
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

  if (activePreset) {
    const visual = PRESET_VISUALS.find(item => item.id === activePreset)!
    const presetSelections = getOfflineSetupPresetSelections(activePreset, lang)
    const selected = selectedPresets.has(activePreset)

    return (
      <Box flex bg="#F4F7FF" pt={insets.top}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('offlineSetup.back')}
            onPress={() => setActivePreset(undefined)}
            hitSlop={10}
          >
            <Box size={44} borderRadius={22} bg="#FFFFFF" center mt={8}>
              <Feather name="arrow-left" size={21} color="#142033" />
            </Box>
          </Pressable>

          <Text title fontSize={34} lineHeight={38} mt={22}>
            {t(`offlineSetup.presets.${activePreset}.title`)}
          </Text>
          <Text color="#68758C" fontSize={15} lineHeight={22} mt={10}>
            {t(`offlineSetup.presets.${activePreset}.description`)}
          </Text>

          <Box width={190} height={172} alignSelf="center" mt={24}>
            <OfflineResourceFolder
              title={t(`offlineSetup.presets.${activePreset}.title`)}
              subtitle={t(`offlineSetup.presets.${activePreset}.subtitle`, {
                count: presetSelections.length,
              })}
              icon={visual.icon}
              selected={selected}
              colors={visual.colors}
            />
          </Box>

          <Text title fontSize={20} mt={26} mb={8}>
            {t('offlineSetup.included')}
          </Text>
          <VStack gap={8}>
            {(activePreset === 'explore-bible' && lang !== 'fr'
              ? DETAIL_KEYS[activePreset].filter(key => key !== 'commentaries')
              : DETAIL_KEYS[activePreset]
            ).map((key, index) => {
              const item = createDownloadItemFromOnboardingSelection(presetSelections[index])
              return (
                <HStack
                  key={key}
                  minHeight={58}
                  px={14}
                  py={10}
                  borderRadius={16}
                  bg="#FFFFFF"
                  alignItems="center"
                  gap={12}
                >
                  <Box size={34} borderRadius={11} bg={visual.colors.back} center>
                    <Feather name="check" size={18} color={visual.colors.icon} />
                  </Box>
                  <Box flex>
                    <Text title fontSize={14}>
                      {t(`offlineSetup.resources.${key}`)}
                    </Text>
                    <Text color="#748096" fontSize={11} mt={2}>
                      {formatMegabytes(item.estimatedSize, lang)}
                    </Text>
                  </Box>
                </HStack>
              )
            })}
          </VStack>
        </ScrollView>

        <Box px={20} pb={Math.max(insets.bottom, 16)} pt={10} bg="#F4F7FF">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              togglePreset(activePreset)
              setActivePreset(undefined)
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
          >
            <Box
              height={58}
              borderRadius={29}
              bg={selected ? '#FFFFFF' : visual.colors.frontEnd}
              borderWidth={selected ? 1 : 0}
              borderColor={visual.colors.frontEnd}
              center
              row
              gap={10}
            >
              <Feather
                name={
                  activePreset === 'read-bible'
                    ? 'check-circle'
                    : selected
                      ? 'minus-circle'
                      : 'plus-circle'
                }
                size={20}
                color={selected ? visual.colors.frontEnd : '#FFFFFF'}
              />
              <Text color={selected ? visual.colors.frontEnd : '#FFFFFF'} title fontSize={16}>
                {t(
                  activePreset === 'read-bible'
                    ? 'offlineSetup.required'
                    : selected
                      ? 'offlineSetup.remove'
                      : 'offlineSetup.add'
                )}
              </Text>
            </Box>
          </Pressable>
        </Box>
      </Box>
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
              {PRESET_VISUALS.slice(startIndex, startIndex + 2).map(visual => {
                const count = getOfflineSetupPresetSelections(visual.id, lang).length
                return (
                  <OfflineResourceFolder
                    key={visual.id}
                    title={t(`offlineSetup.presets.${visual.id}.title`)}
                    subtitle={t(`offlineSetup.presets.${visual.id}.subtitle`, { count })}
                    icon={visual.icon}
                    selected={selectedPresets.has(visual.id)}
                    colors={visual.colors}
                    onPress={() => setActivePreset(visual.id)}
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
