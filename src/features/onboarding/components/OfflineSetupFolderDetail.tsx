import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { createDownloadItemFromOnboardingSelection } from '../onboardingResources'
import type {
  OfflineSetupOption,
  OfflineSetupFolderId,
  OfflineSetupSection,
} from '../offlineSetupPresets'
import { isOfflineSetupOptionLocked } from '../offlineSetupPresets'
import formatResourceSize from '../formatResourceSize'
import OfflineResourceFolder from './OfflineResourceFolder'

export type OfflineSetupFolderVisual = {
  icon: React.ComponentProps<typeof Feather>['name']
  colors: {
    back: string
    frontStart: string
    frontEnd: string
    icon: string
  }
}

type OfflineSetupFolderDetailProps = {
  folderId: OfflineSetupFolderId
  lang: ResourceLanguage
  onBack: () => void
  onSave: () => void
  onToggleOption: (option: OfflineSetupOption) => void
  sections: OfflineSetupSection[]
  selectedOptionIds: readonly string[]
  visual: OfflineSetupFolderVisual
}

const getOptionBytes = (option: OfflineSetupOption): number =>
  [
    ...new Map(
      option.selections.map(selection => {
        const item = createDownloadItemFromOnboardingSelection(selection)
        return [item.id, item]
      })
    ).values(),
  ].reduce((total, item) => total + item.estimatedSize, 0)

const OfflineSetupFolderDetail = ({
  folderId,
  lang,
  onBack,
  onSave,
  onToggleOption,
  sections,
  selectedOptionIds,
  visual,
}: OfflineSetupFolderDetailProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const selectedIds = new Set(selectedOptionIds)
  const allOptions = sections.flatMap(section => section.options)
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => new Set())

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds(current => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  const getOptionLabel = (option: OfflineSetupOption): string => {
    if (!option.labelKey) return option.label
    return t(option.labelKey, {
      name: option.label,
      language: option.language ? t(`offlineSetup.language.${option.language}`) : undefined,
    })
  }

  const getOptionDescription = (option: OfflineSetupOption): string | undefined =>
    option.descriptionKey ? t(option.descriptionKey) : option.description

  return (
    <Box flex bg="#F4F7FF" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.back')}
          onPress={onBack}
          hitSlop={10}
        >
          <Box size={44} borderRadius={22} bg="#FFFFFF" center mt={8}>
            <Feather name="arrow-left" size={21} color="#142033" />
          </Box>
        </Pressable>

        <Text title fontSize={34} lineHeight={38} mt={22}>
          {t(`offlineSetup.presets.${folderId}.title`)}
        </Text>
        <Text color="#68758C" fontSize={15} lineHeight={22} mt={10}>
          {t(`offlineSetup.presets.${folderId}.description`)}
        </Text>

        <Box width={190} height={172} alignSelf="center" mt={24}>
          <OfflineResourceFolder
            width={190}
            title={t(`offlineSetup.presets.${folderId}.title`)}
            subtitle={t('offlineSetup.selectedCount', { count: selectedOptionIds.length })}
            icon={visual.icon}
            selected={selectedOptionIds.length > 0}
            colors={visual.colors}
          />
        </Box>

        <Text title fontSize={20} mt={26} mb={10}>
          {t('offlineSetup.chooseResources')}
        </Text>

        <VStack gap={22}>
          {sections.map(section => {
            const collapsed = Boolean(
              section.collapsedByDefault && !expandedSectionIds.has(section.id)
            )
            return (
              <VStack key={section.id} gap={8}>
                {section.titleKey ? (
                  section.collapsedByDefault ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(section.titleKey)}
                      accessibilityState={{ expanded: !collapsed }}
                      onPress={() => toggleSection(section.id)}
                      hitSlop={8}
                    >
                      <HStack alignItems="center" justifyContent="space-between" px={4} py={4}>
                        <Text color="#68758C" fontSize={11} bold textTransform="uppercase">
                          {t(section.titleKey)}
                        </Text>
                        <Feather
                          name={collapsed ? 'chevron-right' : 'chevron-down'}
                          size={17}
                          color="#68758C"
                        />
                      </HStack>
                    </Pressable>
                  ) : (
                    <Text color="#68758C" fontSize={11} bold textTransform="uppercase" px={4}>
                      {t(section.titleKey)}
                    </Text>
                  )
                ) : null}
                {collapsed
                  ? null
                  : section.options.map(option => {
                      const selected = selectedIds.has(option.id)
                      const locked = isOfflineSetupOptionLocked(
                        option,
                        selectedOptionIds,
                        allOptions
                      )
                      const description = getOptionDescription(option)
                      return (
                        <Pressable
                          key={option.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected, disabled: locked }}
                          accessibilityLabel={getOptionLabel(option)}
                          onPress={() => onToggleOption(option)}
                          style={({ pressed }) => ({ opacity: pressed && !locked ? 0.8 : 1 })}
                        >
                          <HStack
                            minHeight={68}
                            px={14}
                            py={11}
                            borderRadius={17}
                            bg="#FFFFFF"
                            borderWidth={selected ? 1.5 : 1}
                            borderColor={selected ? visual.colors.frontEnd : '#E6EAF2'}
                            alignItems="center"
                            gap={12}
                          >
                            <Box flex>
                              <HStack alignItems="center" gap={7} wrap>
                                <Text title fontSize={14} lineHeight={18} style={{ flexShrink: 1 }}>
                                  {getOptionLabel(option)}
                                </Text>
                                {locked ? (
                                  <Box px={7} py={3} borderRadius={9} bg={visual.colors.back}>
                                    <Text color={visual.colors.icon} fontSize={9} bold>
                                      {t(
                                        option.required
                                          ? 'offlineSetup.requiredBadge'
                                          : 'offlineSetup.includedBadge'
                                      )}
                                    </Text>
                                  </Box>
                                ) : null}
                              </HStack>
                              {description ? (
                                <Text
                                  color="#748096"
                                  fontSize={11}
                                  lineHeight={15}
                                  mt={3}
                                  numberOfLines={1}
                                >
                                  {description}
                                </Text>
                              ) : null}
                              <Text color="#8A94A7" fontSize={10} mt={4}>
                                {formatResourceSize(getOptionBytes(option), lang)}
                              </Text>
                            </Box>
                            <Box
                              size={22}
                              borderRadius={11}
                              borderWidth={1.5}
                              borderColor={selected ? visual.colors.frontEnd : '#C8CFDA'}
                              bg={selected ? visual.colors.frontEnd : '#FFFFFF'}
                              center
                            >
                              {selected ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
                            </Box>
                          </HStack>
                        </Pressable>
                      )
                    })}
              </VStack>
            )
          })}
        </VStack>
      </ScrollView>

      <Box px={20} pb={Math.max(insets.bottom, 16)} pt={10} bg="#F4F7FF">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.add')}
          onPress={onSave}
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Box height={58} borderRadius={29} bg={visual.colors.frontEnd} center row gap={10}>
            <Feather name="check" size={20} color="#FFFFFF" />
            <Text color="#FFFFFF" title fontSize={16}>
              {t('offlineSetup.add')}
            </Text>
          </Box>
        </Pressable>
      </Box>
    </Box>
  )
}

export default OfflineSetupFolderDetail
