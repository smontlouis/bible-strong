import React, { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useAtom } from 'jotai'
import { Pressable, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { type AnimatedStyle } from 'react-native-reanimated'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors, type Universe } from '~themes/universeColors'
import DictionnaryIcon from '~common/DictionnaryIcon'
import Header from '~common/Header'
import LexiqueIcon from '~common/LexiqueIcon'
import NaveIcon from '~common/NaveIcon'
import Container from '~common/ui/Container'
import Box, { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import IconTile, { ICON_TILE_SIZE } from '~common/ui/IconTile'
import { ListSectionTitle, ListSeparator } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import { FeatherIcon } from '~common/ui/Icon'
import { radii } from '~common/ui/surfaces'
import { resetCompareVersion, setDefaultBibleVersion } from '~redux/modules/user'
import {
  resourcesLanguageAtom,
  resetAllResourcesLanguage,
  type ResourcesLanguageState,
} from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
// Each resource shows in its universe colours, as in the More screen.
type ResourceConfig = {
  id: keyof ResourcesLanguageState
  labelKey: string
  descriptionKey: string
  universe: Extract<Universe, 'strong' | 'dictionary' | 'nave' | 'timeline'>
}

const RESOURCES_CONFIG: ResourceConfig[] = [
  {
    id: 'STRONG',
    labelKey: 'Lexique Strong',
    descriptionKey: 'resourceLanguage.strongDesc',
    universe: 'strong',
  },
  {
    id: 'DICTIONNAIRE',
    labelKey: 'Dictionnaire',
    descriptionKey: 'resourceLanguage.dictDesc',
    universe: 'dictionary',
  },
  {
    id: 'NAVE',
    labelKey: 'Bible Thématique Nave',
    descriptionKey: 'resourceLanguage.naveDesc',
    universe: 'nave',
  },
  {
    id: 'TIMELINE',
    labelKey: 'Chronologie',
    descriptionKey: 'resourceLanguage.timelineDesc',
    universe: 'timeline',
  },
]

const ResourceUniverseIcon = ({ universe }: { universe: ResourceConfig['universe'] }) => {
  const theme = useTheme()
  switch (universe) {
    case 'strong':
      return <LexiqueIcon size={18} />
    case 'dictionary':
      return <DictionnaryIcon size={18} />
    case 'nave':
      return <NaveIcon size={18} />
    case 'timeline':
      return (
        <FeatherIcon
          name="clock"
          size={18}
          color={resolveUniverseColors(theme.colors, 'timeline').foreground}
        />
      )
  }
}

// The row's text starts after its padding, the icon tile and the gap.
const RESOURCE_TEXT_INSET = 14 + ICON_TILE_SIZE + 12

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
  const indicatorStyle: AnimatedStyle<ViewStyle> = {
    position: 'absolute',
    top: 3,
    left: value === 'fr' ? 3 : containerWidth / 2 + 1,
    width: indicatorWidth,
    height: height - 6,
    backgroundColor: theme.colors.primary,
    borderRadius: radii.pill,
    transitionProperty: 'left',
    transitionDuration: 250,
    transitionTimingFunction: 'ease-out',
  }
  const frenchTextStyle: AnimatedStyle<TextStyle> = {
    fontSize: isLarge ? 16 : 13,
    fontWeight: '600',
    color: value === 'fr' ? '#FFFFFF' : theme.colors.grey,
    transitionProperty: 'color',
    transitionDuration: 200,
  }
  const englishTextStyle: AnimatedStyle<TextStyle> = {
    fontSize: isLarge ? 16 : 13,
    fontWeight: '600',
    color: value === 'en' ? '#FFFFFF' : theme.colors.grey,
    transitionProperty: 'color',
    transitionDuration: 200,
  }

  // The track sits on a card: the canvas is the recessed level in every theme.
  return (
    <Box
      className="overflow-hidden border-continuous rounded-full bg-canvas flex-row p-[3px] relative"
      style={{ width: containerWidth, height: height }}
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

  return (
    <Box className="mx-[20px] mb-[22px]">
      <Card className="p-[24px] items-center justify-center">
        <IconTile tint="primary" size={44} className="mb-[14px]">
          <FeatherIcon name="globe" size={22} color="primary" />
        </IconTile>

        <Text className="font-bold text-[18px] mb-[6px]">{t('language.appLanguage')}</Text>

        <Text className="text-[14px] text-grey text-center mb-[20px] px-[12px]">
          {t('language.appLanguageDesc')}
        </Text>

        {/* Large segmented control */}
        <SegmentedLanguageToggle value={currentLang} onChange={onLanguageChange} size="large" />
      </Card>
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
}

const ResourceRow = ({
  resource,
  label,
  description,
  currentLang,
  onLanguageChange,
}: ResourceRowProps) => {
  const { t } = useTranslation()
  const theme = useTheme()

  return (
    <HStack className="px-[14px] py-[10px] items-center gap-[12px]">
      <IconTile bg={resolveUniverseColors(theme.colors, resource.universe).background}>
        <ResourceUniverseIcon universe={resource.universe} />
      </IconTile>

      <VStack className="flex-[1]">
        <Text className="text-[15px]" numberOfLines={2}>
          {t(label)}
        </Text>
        <Text className="text-[13px] text-grey mt-[2px]" numberOfLines={2}>
          {t(description)}
        </Text>
      </VStack>

      {/* Compact toggle */}
      <SegmentedLanguageToggle value={currentLang} onChange={onLanguageChange} size="compact" />
    </HStack>
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
    <Container className="bg-canvas">
      <Header hasBackButton title={t('Changer la langue')} />
      <ScrollView
        backgroundColor="canvas"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero App Language Section */}
        <AppLanguageSection
          currentLang={currentAppLang}
          onLanguageChange={handleAppLanguageChange}
        />

        {/* Not ListRows: a pressable row would swallow the radios of its toggle. */}
        <Box className="mx-[20px] mb-[22px]">
          <ListSectionTitle>{t('resourceLanguage.perResource')}</ListSectionTitle>
          <Card>
            {RESOURCES_CONFIG.map((resource, index) => (
              <Fragment key={resource.id}>
                {index > 0 && <ListSeparator inset={RESOURCE_TEXT_INSET} />}
                <ResourceRow
                  resource={resource}
                  label={resource.labelKey}
                  description={resource.descriptionKey}
                  currentLang={resourcesLanguages[resource.id]}
                  onLanguageChange={lang => handleLanguageChange(resource.id, lang)}
                />
              </Fragment>
            ))}
          </Card>
          <Text className="text-[13px] text-grey mt-[8px] mx-[4px]">
            {t('resourceLanguage.description')}
          </Text>
        </Box>

        {/* Footer note */}
        <Box className="px-[24px]">
          <Text className="text-[13px] text-grey">{t('resourceLanguage.note')}</Text>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default ResourceLanguageScreen
