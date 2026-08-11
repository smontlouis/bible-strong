import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { AnimatedBox, HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { OfflineResourceSizeManifest } from '~helpers/offlineResourceSizeManifest'
import type {
  OfflineSetupOption,
  OfflineSetupFolderId,
  OfflineSetupSection,
} from '../offlineSetupPresets'
import { OFFLINE_SETUP_MOTION } from '../offlineSetupMotion'
import type { OfflineSetupFolderVisual } from '../offlineSetupPresentation'
import OfflineSetupResourceOption from './OfflineSetupResourceOption'

type OfflineSetupFolderDetailProps = {
  contentVisible: boolean
  folderId: OfflineSetupFolderId
  lang: ResourceLanguage
  lockedOptionIds: ReadonlySet<string>
  onToggleOption: (option: OfflineSetupOption) => void
  sections: OfflineSetupSection[]
  selectedOptionIds: readonly string[]
  sizeManifest: OfflineResourceSizeManifest
  visual: OfflineSetupFolderVisual
}

const DETAIL_SHEET_HEIGHT = OFFLINE_SETUP_MOTION.reviewSheet.closedHeight

const OfflineSetupSectionTitle = ({
  collapsed,
  collapsible,
  onToggle,
  titleKey,
}: {
  collapsed: boolean
  collapsible: boolean
  onToggle: () => void
  titleKey?: string
}) => {
  const { t } = useTranslation()
  if (!titleKey) return null

  if (!collapsible) {
    return (
      <Text color="#68758C" fontSize={11} bold textTransform="uppercase" px={4}>
        {t(titleKey)}
      </Text>
    )
  }

  const chevronIcon = collapsed ? 'chevron-right' : 'chevron-down'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(titleKey)}
      accessibilityState={{ expanded: !collapsed }}
      onPress={onToggle}
      hitSlop={8}
    >
      <HStack alignItems="center" justifyContent="space-between" px={4} py={4}>
        <Text color="#68758C" fontSize={11} bold textTransform="uppercase">
          {t(titleKey)}
        </Text>
        <Feather name={chevronIcon} size={17} color="#68758C" />
      </HStack>
    </Pressable>
  )
}

const OfflineSetupFolderDetail = ({
  contentVisible,
  folderId,
  lang,
  lockedOptionIds,
  onToggleOption,
  sections,
  selectedOptionIds,
  sizeManifest,
  visual,
}: OfflineSetupFolderDetailProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const selectedIds = new Set(selectedOptionIds)
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => new Set())
  const footerBottomInset = Math.max(insets.bottom, 16)

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds(current => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  return (
    <Box flex bg="#F4F7FF">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 26,
          paddingBottom: DETAIL_SHEET_HEIGHT + footerBottomInset + 24,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={contentVisible}
        pointerEvents={contentVisible ? 'auto' : 'none'}
      >
        <AnimatedBox
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: [{ translateY: contentVisible ? 0 : -10 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: contentVisible ? 300 : 190,
            transitionDelay: 0,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <Text title fontSize={34} lineHeight={38} maxWidth={280}>
            {t('offlineSetup.chooseResources')}
          </Text>
          <Text color="#68758C" fontSize={15} lineHeight={22} mt={10}>
            {t(`offlineSetup.presets.${folderId}.description`)}
          </Text>
        </AnimatedBox>

        <AnimatedBox
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: [{ translateY: contentVisible ? 0 : 14 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: contentVisible ? 340 : 210,
            transitionDelay: contentVisible ? 40 : 0,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <VStack gap={22} mt={28}>
            {sections.map(section => {
              const collapsed = Boolean(
                section.collapsedByDefault && !expandedSectionIds.has(section.id)
              )
              return (
                <VStack key={section.id} gap={8}>
                  <OfflineSetupSectionTitle
                    collapsed={collapsed}
                    collapsible={Boolean(section.collapsedByDefault)}
                    onToggle={() => toggleSection(section.id)}
                    titleKey={section.titleKey}
                  />
                  {!collapsed
                    ? section.options.map(option => {
                        const selected = selectedIds.has(option.id)
                        const locked = lockedOptionIds.has(option.id)
                        return (
                          <OfflineSetupResourceOption
                            key={option.id}
                            lang={lang}
                            locked={locked}
                            onPress={() => onToggleOption(option)}
                            option={option}
                            selected={selected}
                            sizeManifest={sizeManifest}
                            visual={visual}
                          />
                        )
                      })
                    : null}
                </VStack>
              )
            })}
          </VStack>
        </AnimatedBox>
      </ScrollView>
    </Box>
  )
}

export default OfflineSetupFolderDetail
