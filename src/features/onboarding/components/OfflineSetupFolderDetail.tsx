import { Feather } from '@expo/vector-icons'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
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
import type { OfflineSetupFolderVisual, OfflineSetupFrame } from '../offlineSetupPresentation'
import OfflineResourceFolder from './OfflineResourceFolder'
import OfflineSetupResourceOption from './OfflineSetupResourceOption'

type OfflineSetupFolderDetailProps = {
  contentVisible: boolean
  folderId: OfflineSetupFolderId
  heroOverlayActive: boolean
  lang: ResourceLanguage
  lockedOptionIds: ReadonlySet<string>
  onClose: (heroFrame?: OfflineSetupFrame) => void
  onHeroTargetLayout: (heroFrame: OfflineSetupFrame) => void
  onToggleOption: (option: OfflineSetupOption) => void
  sections: OfflineSetupSection[]
  selectedOptionIds: readonly string[]
  sizeManifest: OfflineResourceSizeManifest
  visual: OfflineSetupFolderVisual
}

const DETAIL_FOOTER_HEIGHT = 68

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
  heroOverlayActive,
  lang,
  lockedOptionIds,
  onClose,
  onHeroTargetLayout,
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
  const heroRef = useRef<View | null>(null)
  const footerBottomInset = Math.max(insets.bottom, 16)

  const measureHero = (onMeasured: (frame?: OfflineSetupFrame) => void) => {
    if (!heroRef.current) {
      onMeasured(undefined)
      return
    }

    heroRef.current.measureInWindow((x, y, width, height) => {
      onMeasured({ x, y, width, height })
    })
  }

  const reportHeroTarget = () => {
    measureHero(frame => {
      if (frame) onHeroTargetLayout(frame)
    })
  }

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
          paddingBottom: DETAIL_FOOTER_HEIGHT + footerBottomInset + 24,
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
            transitionDuration: contentVisible ? 360 : 190,
            transitionDelay: contentVisible ? 40 : 0,
            transitionTimingFunction: 'ease-out',
          }}
        >
          <Text title fontSize={34} lineHeight={38}>
            {t(`offlineSetup.presets.${folderId}.title`)}
          </Text>
          <Text color="#68758C" fontSize={15} lineHeight={22} mt={10}>
            {t(`offlineSetup.presets.${folderId}.description`)}
          </Text>
        </AnimatedBox>

        <Box width={190} height={172} alignSelf="center" mt={24} overflow="visible">
          <View
            ref={heroRef}
            collapsable={false}
            onLayout={reportHeroTarget}
            style={{ overflow: 'visible' }}
          >
            <Box opacity={heroOverlayActive ? 0 : 1} overflow="visible">
              <OfflineResourceFolder
                width={190}
                title={t(`offlineSetup.presets.${folderId}.title`)}
                subtitle={t('offlineSetup.selectedCount', { count: selectedOptionIds.length })}
                icon={visual.icon}
                itemCount={selectedOptionIds.length}
                selected={selectedOptionIds.length > 0}
                showChevron={false}
                colors={visual.colors}
              />
            </Box>
          </View>

          <AnimatedBox
            position="absolute"
            left={-58}
            top={64}
            style={{
              opacity: contentVisible ? 1 : 0,
              transform: [{ translateX: contentVisible ? 0 : 8 }],
              transitionProperty: ['opacity', 'transform'],
              transitionDuration: contentVisible ? 260 : 170,
              transitionDelay: contentVisible ? 90 : 0,
              transitionTimingFunction: 'ease-out',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('offlineSetup.back')}
              onPress={() => measureHero(onClose)}
              hitSlop={10}
              style={({ pressed }) => ({
                opacity: pressed ? 0.8 : 1,
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              <Box size={44} borderRadius={22} bg="#FFFFFF" center>
                <Feather name="arrow-left" size={21} color="#142033" />
              </Box>
            </Pressable>
          </AnimatedBox>
        </Box>

        <AnimatedBox
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: [{ translateY: contentVisible ? 0 : 14 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: contentVisible ? 400 : 210,
            transitionDelay: contentVisible ? 120 : 0,
            transitionTimingFunction: 'ease-out',
          }}
        >
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

      <AnimatedBox
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        zIndex={20}
        px={20}
        pb={footerBottomInset}
        pt={10}
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: [{ translateY: contentVisible ? 0 : 14 }],
          transitionProperty: ['opacity', 'transform'],
          transitionDuration: contentVisible ? 360 : 190,
          transitionDelay: contentVisible ? 170 : 0,
          transitionTimingFunction: 'ease-out',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('offlineSetup.add')}
          onPress={() => measureHero(onClose)}
          style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
        >
          <Box height={58} borderRadius={29} bg={visual.colors.frontEnd} center row gap={10}>
            <Feather name="check" size={20} color="#FFFFFF" />
            <Text color="#FFFFFF" title fontSize={16}>
              {t('offlineSetup.add')}
            </Text>
          </Box>
        </Pressable>
      </AnimatedBox>
    </Box>
  )
}

export default OfflineSetupFolderDetail
