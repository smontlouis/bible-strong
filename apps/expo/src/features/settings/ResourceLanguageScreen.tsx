import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useAtom } from 'jotai'
import { Pressable } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'
import { useTheme } from '~themes/ThemeProvider'
import { Image } from 'expo-image'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import { FeatherIcon } from '~common/ui/Icon'
import { resetCompareVersion, setDefaultBibleVersion } from '~redux/modules/user'
import {
  resourcesLanguageAtom,
  resetAllResourcesLanguage,
  type ResourcesLanguageState,
} from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
// Icons mapping using SVG files
const icons = {
  strong: require('~assets/images/tab-icons/lexique.svg'),
  dictionary: require('~assets/images/tab-icons/dictionary.svg'),
  nave: require('~assets/images/tab-icons/nave.svg'),
}

// Resource configuration
type SvgIconType = keyof typeof icons
type FeatherIconType = 'align-left' | 'clock'

type ResourceConfig = {
  id: keyof ResourcesLanguageState
  labelKey: string
  descriptionKey: string
} & ({ iconType: 'svg'; icon: SvgIconType } | { iconType: 'feather'; icon: FeatherIconType })

const RESOURCES_CONFIG: ResourceConfig[] = [
  {
    id: 'STRONG',
    labelKey: 'Lexique Strong',
    descriptionKey: 'resourceLanguage.strongDesc',
    iconType: 'svg',
    icon: 'strong',
  },
  {
    id: 'DICTIONNAIRE',
    labelKey: 'Dictionnaire',
    descriptionKey: 'resourceLanguage.dictDesc',
    iconType: 'svg',
    icon: 'dictionary',
  },
  {
    id: 'NAVE',
    labelKey: 'Bible Thématique Nave',
    descriptionKey: 'resourceLanguage.naveDesc',
    iconType: 'svg',
    icon: 'nave',
  },
  {
    id: 'TIMELINE',
    labelKey: 'Chronologie',
    descriptionKey: 'resourceLanguage.timelineDesc',
    iconType: 'feather',
    icon: 'clock',
  },
]

// Segmented Toggle Component with CSS transitions
interface SegmentedLanguageToggleProps {
  value: ResourceLanguage
  onChange: (lang: ResourceLanguage) => void
  size?: 'compact' | 'large'
}

const SegmentedLanguageToggle = ({
  value,
  onChange,
  size = 'compact',
}: SegmentedLanguageToggleProps) => {
  const theme = useTheme()
  const isLarge = size === 'large'

  const containerWidth = isLarge ? 200 : 100
  const height = isLarge ? 44 : 36
  const indicatorWidth = containerWidth / 2 - 4
  const indicatorStyle: AnimatedStyle = {
    position: 'absolute',
    top: 3,
    left: value === 'fr' ? 3 : containerWidth / 2 + 1,
    width: indicatorWidth,
    height: height - 6,
    backgroundColor: theme.colors.primary,
    borderRadius: (height - 6) / 2,
    transitionProperty: 'left',
    transitionDuration: 250,
    transitionTimingFunction: 'ease-out',
  }
  const frenchTextStyle: AnimatedStyle = {
    fontSize: isLarge ? 16 : 13,
    fontWeight: '600',
    color: value === 'fr' ? '#FFFFFF' : theme.colors.grey,
    textTransform: 'uppercase',
    transitionProperty: 'color',
    transitionDuration: 200,
  }
  const englishTextStyle: AnimatedStyle = {
    fontSize: isLarge ? 16 : 13,
    fontWeight: '600',
    color: value === 'en' ? '#FFFFFF' : theme.colors.grey,
    textTransform: 'uppercase',
    transitionProperty: 'color',
    transitionDuration: 200,
  }

  return (
    <Box
      className="overflow-hidden border-continuous bg-light-grey flex-row p-[3px] relative"
      style={{ width: containerWidth, height: height, borderRadius: height / 2 }}
    >
      {/* Animated sliding indicator */}
      <Animated.View style={indicatorStyle} />

      {/* FR Button */}
      <Pressable
        accessibilityLabel="Français"
        accessibilityRole="radio"
        accessibilityState={{ checked: value === 'fr' }}
        onPress={() => onChange('fr')}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
      >
        <Animated.Text style={frenchTextStyle}>{isLarge ? 'Français' : 'FR'}</Animated.Text>
      </Pressable>

      {/* EN Button */}
      <Pressable
        accessibilityLabel="English"
        accessibilityRole="radio"
        accessibilityState={{ checked: value === 'en' }}
        onPress={() => onChange('en')}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
      >
        <Animated.Text style={englishTextStyle}>{isLarge ? 'English' : 'EN'}</Animated.Text>
      </Pressable>
    </Box>
  )
}

// Hero Section for App Language
interface AppLanguageSectionProps {
  currentLang: ResourceLanguage
  onLanguageChange: (lang: ResourceLanguage) => void
}

const AppLanguageSection = ({ currentLang, onLanguageChange }: AppLanguageSectionProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Box
      className="overflow-hidden border-continuous mx-[16px] mt-[16px] mb-[24px] p-[24px] bg-reverse rounded-[20px] items-center justify-center"
      style={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      {/* Globe icon */}
      <Box
        className="overflow-hidden border-continuous rounded-[32px] bg-light-grey items-center justify-center mb-[16px]"
        style={[{ width: 64, height: 64 }, { backgroundColor: 'rgba(89, 131, 240, 0.1)' }]}
      >
        <FeatherIcon name="globe" size={28} color={theme.colors.primary} />
      </Box>

      <Text className="font-bold text-[20px] mb-[8px]">{t('language.appLanguage')}</Text>

      <Text className="text-[14px] text-grey text-center mb-[20px] px-[20px]">
        {t('language.appLanguageDesc')}
      </Text>

      {/* Large segmented control */}
      <SegmentedLanguageToggle value={currentLang} onChange={onLanguageChange} size="large" />
    </Box>
  )
}

// Resource Row Component
interface ResourceRowProps {
  resource: ResourceConfig
  label: string
  description: string
  currentLang: ResourceLanguage
  onLanguageChange: (lang: ResourceLanguage) => void
  isLast?: boolean
}

const ResourceRow = ({
  resource,
  label,
  description,
  currentLang,
  onLanguageChange,
  isLast,
}: ResourceRowProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <Box className="overflow-hidden border-continuous">
      <HStack className="overflow-hidden border-continuous px-[20px] py-[16px] items-center">
        {/* Resource icon */}
        <Box
          className="overflow-hidden border-continuous rounded-[12px] bg-light-grey items-center justify-center mr-[14px]"
          style={{ width: 40, height: 40 }}
        >
          {resource.iconType === 'svg' ? (
            <Image
              source={icons[resource.icon]}
              style={{ width: 20, height: 20 }}
              tintColor={theme.colors.grey}
              contentFit="contain"
            />
          ) : (
            <FeatherIcon name={resource.icon} size={20} color={theme.colors.grey} />
          )}
        </Box>

        {/* Text content */}
        <VStack className="overflow-hidden border-continuous flex-[1] mr-[12px]">
          <Text className="font-bold text-[15px] mb-[2px]">{t(label)}</Text>
          <Text className="text-[12px] text-grey" numberOfLines={2}>
            {t(description)}
          </Text>
        </VStack>

        {/* Compact toggle */}
        <SegmentedLanguageToggle value={currentLang} onChange={onLanguageChange} size="compact" />
      </HStack>

      {/* Separator - inset aligned with text */}
      {!isLast && (
        <Box className="overflow-hidden border-continuous h-[1px] bg-light-grey mx-[20px] ml-[74px]" />
      )}
    </Box>
  )
}

const ResourceLanguageScreen = () => {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()

  const [resourcesLanguages, setResourcesLanguages] = useAtom(resourcesLanguageAtom)
  const currentAppLang = i18n.language as ResourceLanguage

  const handleLanguageChange = (
    resourceId: keyof ResourcesLanguageState,
    lang: ResourceLanguage
  ) => {
    setResourcesLanguages(prev => ({ ...prev, [resourceId]: lang }))
  }

  const applyAppLanguageChange = (lang: ResourceLanguage) => {
    const defaultVersion = getDefaultBibleVersion(lang)

    i18n.changeLanguage(lang)
    resetAllResourcesLanguage(lang)

    dispatch(setDefaultBibleVersion(defaultVersion))
    dispatch(resetCompareVersion())
  }

  const handleAppLanguageChange = (lang: ResourceLanguage) => {
    if (lang === currentAppLang) return
    applyAppLanguageChange(lang)
  }

  return (
    <Container>
      <Header hasBackButton title={t('Changer la langue')} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero App Language Section */}
        <AppLanguageSection
          currentLang={currentAppLang}
          onLanguageChange={handleAppLanguageChange}
        />

        {/* Per-Resource Section Header */}
        <Box className="overflow-hidden border-continuous mx-[16px] mb-[8px]">
          <Text
            className="font-bold text-[13px] text-grey mb-[8px]"
            style={{ textTransform: 'uppercase' }}
          >
            {t('resourceLanguage.perResource')}
          </Text>
          <Text className="text-[13px] text-grey">{t('resourceLanguage.description')}</Text>
        </Box>

        {/* Resources Card */}
        <Box
          className="border-continuous overflow-visible mx-[16px] bg-reverse rounded-[16px]"
          style={{
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 7,
            elevation: 1,
            overflow: 'visible',
          }}
        >
          {RESOURCES_CONFIG.map((resource, index) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              label={resource.labelKey}
              description={resource.descriptionKey}
              currentLang={resourcesLanguages[resource.id]}
              onLanguageChange={lang => handleLanguageChange(resource.id, lang)}
              isLast={index === RESOURCES_CONFIG.length - 1}
            />
          ))}
        </Box>

        {/* Footer note */}
        <Box className="overflow-hidden border-continuous px-[20px] pt-[20px]">
          <Text className="text-[12px] text-grey text-center">{t('resourceLanguage.note')}</Text>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ResourceLanguageScreen
