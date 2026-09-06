import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
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
import type { OfflineSetupPalette } from '../offlineSetupPalette'
import { OFFLINE_SETUP_HEADER_TOP_OFFSET } from '../offlineSetupPresentation'
import OfflineSetupResourceOption from './OfflineSetupResourceOption'
type OfflineSetupFolderDetailProps = {
  contentVisible: boolean
  folderId: OfflineSetupFolderId
  lang: ResourceLanguage
  lockedOptionIds: ReadonlySet<string>
  onToggleOption: (option: OfflineSetupOption) => void
  palette: OfflineSetupPalette
  sections: OfflineSetupSection[]
  selectedOptionIds: readonly string[]
  sizeManifest: OfflineResourceSizeManifest
}

const DETAIL_SHEET_HEIGHT = OFFLINE_SETUP_MOTION.reviewSheet.closedHeight

const OfflineSetupSectionTitle = ({
  collapsed,
  collapsible,
  onToggle,
  palette,
  titleKey,
}: {
  collapsed: boolean
  collapsible: boolean
  onToggle: () => void
  palette: OfflineSetupPalette
  titleKey?: string
}) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  if (!titleKey) return null

  if (!collapsible) {
    return (
      <Text
        className="text-[11px] font-bold uppercase px-[4px]"
        style={{
          color:
            resolveThemeColor(stylingTheme, palette.description) || stylingTheme.colors.default,
        }}
      >
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
      <HStack className="overflow-hidden border-continuous items-center justify-between px-[4px] py-[4px]">
        <Text
          className="text-[11px] font-bold uppercase"
          style={{
            color:
              resolveThemeColor(stylingTheme, palette.description) || stylingTheme.colors.default,
          }}
        >
          {t(titleKey)}
        </Text>
        <Feather name={chevronIcon} size={17} color={palette.description} />
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
  palette,
  sections,
  selectedOptionIds,
  sizeManifest,
}: OfflineSetupFolderDetailProps) => {
  const stylingTheme = useStylingTheme()

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
    <Box className="overflow-hidden border-continuous flex-[1]">
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + OFFLINE_SETUP_HEADER_TOP_OFFSET,
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
            transitionDuration: contentVisible
              ? OFFLINE_SETUP_MOTION.detail.header.enterDuration
              : OFFLINE_SETUP_MOTION.detail.header.exitDuration,
            transitionDelay: 0,
            transitionTimingFunction: 'ease-out',
          }}
          className="overflow-hidden border-continuous"
        >
          <Text
            className="text-[34px] leading-[38px] max-w-[280px]"
            style={{
              color: resolveThemeColor(stylingTheme, palette.title) || stylingTheme.colors.default,
              fontFamily: resolveFontFamily(stylingTheme.fontFamily.title),
            }}
          >
            {t('offlineSetup.chooseResources')}
          </Text>
          <Text
            className="text-[15px] leading-[22px] mt-[10px]"
            style={{
              color:
                resolveThemeColor(stylingTheme, palette.description) || stylingTheme.colors.default,
            }}
          >
            {t(`offlineSetup.presets.${folderId}.description`)}
          </Text>
        </AnimatedBox>

        <AnimatedBox
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: [{ translateY: contentVisible ? 0 : 14 }],
            transitionProperty: ['opacity', 'transform'],
            transitionDuration: contentVisible
              ? OFFLINE_SETUP_MOTION.detail.resourceList.enterDuration
              : OFFLINE_SETUP_MOTION.detail.resourceList.exitDuration,
            transitionDelay: contentVisible
              ? OFFLINE_SETUP_MOTION.detail.resourceList.enterDelay
              : 0,
            transitionTimingFunction: 'ease-out',
          }}
          className="overflow-hidden border-continuous"
        >
          <VStack className="overflow-hidden border-continuous gap-[22px] mt-[28px]">
            {sections.map(section => {
              const collapsed = Boolean(
                section.collapsedByDefault && !expandedSectionIds.has(section.id)
              )
              const optionGroups = [
                ...(section.options.length
                  ? [{ id: section.id, titleKey: undefined, options: section.options }]
                  : []),
                ...(section.groups ?? []),
              ]
              return (
                <VStack
                  className="overflow-hidden border-continuous"
                  key={section.id}
                  style={{ gap: section.groups?.length ? 16 : 8 }}
                >
                  <OfflineSetupSectionTitle
                    collapsed={collapsed}
                    collapsible={Boolean(section.collapsedByDefault)}
                    onToggle={() => toggleSection(section.id)}
                    palette={palette}
                    titleKey={section.titleKey}
                  />
                  {!collapsed ? (
                    <VStack className="overflow-hidden border-continuous gap-[18px]">
                      {optionGroups.map(group => (
                        <VStack
                          className="overflow-hidden border-continuous gap-[8px]"
                          key={group.id}
                        >
                          <OfflineSetupSectionTitle
                            collapsed={false}
                            collapsible={false}
                            onToggle={() => undefined}
                            palette={palette}
                            titleKey={group.titleKey}
                          />
                          {group.options.map(option => {
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
                                palette={palette}
                              />
                            )
                          })}
                        </VStack>
                      ))}
                    </VStack>
                  ) : null}
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
