import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useAtom } from 'jotai'
import { TouchableOpacity } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTheme } from '@emotion/react'
import { StackScreenProps } from '@react-navigation/stack'

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
import { MainStackProps } from '~navigation/type'

// Icons mapping using SVG files
const icons = {
  strong: require('~assets/images/tab-icons/lexique.svg'),
  dictionary: require('~assets/images/tab-icons/dictionary.svg'),
  nave: require('~assets/images/tab-icons/nave.svg'),
  commentary: require('~assets/images/tab-icons/comment.svg'),
  search: require('~assets/images/tab-icons/search.svg'),
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
    id: 'INTERLINEAIRE',
    labelKey: 'Interlinéaire',
    descriptionKey: 'resourceLanguage.interlineaireDesc',
    iconType: 'feather',
    icon: 'align-left',
  },
  {
    id: 'TIMELINE',
    labelKey: 'Chronologie',
    descriptionKey: 'resourceLanguage.timelineDesc',
    iconType: 'feather',
    icon: 'clock',
  },
  {
    id: 'SEARCH',
    labelKey: 'Index de recherche',
    descriptionKey: 'resourceLanguage.searchDesc',
    iconType: 'svg',
    icon: 'search',
  },
  {
    id: 'COMMENTARIES',
    labelKey: 'Commentaires',
    descriptionKey: 'resourceLanguage.commentariesDesc',
    iconType: 'svg',
    icon: 'commentary',
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

  return (
    <Box
      w={containerWidth}
      h={height}
      bg="lightGrey"
      borderRadius={height / 2}
      row
      p={3}
      position="relative"
    >
      {/* Animated sliding indicator */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 3,
          left: value === 'fr' ? 3 : containerWidth / 2 + 1,
          width: indicatorWidth,
          height: height - 6,
          backgroundColor: theme.colors.primary,
          borderRadius: (height - 6) / 2,
          // @ts-ignore - CSS Transitions for Reanimated 4
          transitionProperty: 'left',
          transitionDuration: 250,
          transitionTimingFunction: 'ease-out',
        }}
      />

      {/* FR Button */}
      <TouchableOpacity
        onPress={() => onChange('fr')}
        activeOpacity={0.8}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
      >
        <Animated.Text
          style={{
            fontSize: isLarge ? 16 : 13,
            fontWeight: '600',
            color: value === 'fr' ? '#FFFFFF' : theme.colors.grey,
            textTransform: 'uppercase',
            // @ts-ignore - CSS Transitions for Reanimated 4
            transitionProperty: 'color',
            transitionDuration: 200,
          }}
        >
          {isLarge ? 'Français' : 'FR'}
        </Animated.Text>
      </TouchableOpacity>

      {/* EN Button */}
      <TouchableOpacity
        onPress={() => onChange('en')}
        activeOpacity={0.8}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}
      >
        <Animated.Text
          style={{
            fontSize: isLarge ? 16 : 13,
            fontWeight: '600',
            color: value === 'en' ? '#FFFFFF' : theme.colors.grey,
            textTransform: 'uppercase',
            // @ts-ignore - CSS Transitions for Reanimated 4
            transitionProperty: 'color',
            transitionDuration: 200,
          }}
        >
          {isLarge ? 'English' : 'EN'}
        </Animated.Text>
      </TouchableOpacity>
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
    <Box mx={16} mt={16} mb={24} p={24} bg="reverse" borderRadius={20} lightShadow center>
      {/* Globe icon */}
      <Box
        size={64}
        borderRadius={32}
        bg="lightGrey"
        center
        mb={16}
        style={{ backgroundColor: 'rgba(89, 131, 240, 0.1)' }}
      >
        <FeatherIcon name="globe" size={28} color={theme.colors.primary} />
      </Box>

      <Text bold fontSize={20} mb={8}>
        {t('language.appLanguage')}
      </Text>

      <Text fontSize={14} color="grey" textAlign="center" mb={20} px={20}>
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
    <Box>
      <HStack px={20} py={16} alignItems="center">
        {/* Resource icon */}
        <Box size={40} borderRadius={12} bg="lightGrey" center mr={14}>
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
        <VStack flex mr={12}>
          <Text bold fontSize={15} mb={2}>
            {t(label)}
          </Text>
          <Text fontSize={12} color="grey" numberOfLines={2}>
            {t(description)}
          </Text>
        </VStack>

        {/* Compact toggle */}
        <SegmentedLanguageToggle value={currentLang} onChange={onLanguageChange} size="compact" />
      </HStack>

      {/* Separator - inset aligned with text */}
      {!isLast && <Box h={1} bg="lightGrey" mx={20} ml={74} />}
    </Box>
  )
}

const ResourceLanguageScreen = ({}: StackScreenProps<MainStackProps, 'ResourceLanguage'>) => {
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

  const handleAppLanguageChange = (lang: ResourceLanguage) => {
    if (lang === currentAppLang) return

    i18n.changeLanguage(lang)
    resetAllResourcesLanguage(lang)

    const defaultVersion = lang === 'fr' ? 'LSG' : 'KJV'
    dispatch(setDefaultBibleVersion(defaultVersion))
    dispatch(resetCompareVersion(defaultVersion))
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
        <Box mx={16} mb={8}>
          <Text bold fontSize={13} color="grey" style={{ textTransform: 'uppercase' }} mb={8}>
            {t('resourceLanguage.perResource')}
          </Text>
          <Text fontSize={13} color="grey">
            {t('resourceLanguage.description')}
          </Text>
        </Box>

        {/* Resources Card */}
        <Box mx={16} bg="reverse" borderRadius={16} overflow="hidden" lightShadow>
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
        <Box px={20} pt={20}>
          <Text fontSize={12} color="grey" textAlign="center">
            {t('resourceLanguage.note')}
          </Text>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ResourceLanguageScreen
