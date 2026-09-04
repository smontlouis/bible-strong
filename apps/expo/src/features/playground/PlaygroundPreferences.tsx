import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'

import type { CurrentTheme } from '~common/types'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import themes from '~themes'

type PlaygroundThemeOption = {
  id: CurrentTheme
  labelKey: string
}

export const PLAYGROUND_THEME_OPTIONS: readonly PlaygroundThemeOption[] = [
  { id: 'default', labelKey: 'Blanc' },
  { id: 'sepia', labelKey: 'Sépia' },
  { id: 'nature', labelKey: 'Nature' },
  { id: 'sunset', labelKey: 'Soleil couchant' },
  { id: 'dark', labelKey: 'Sombre' },
  { id: 'black', labelKey: 'Noir' },
  { id: 'mauve', labelKey: 'Mauve' },
  { id: 'night', labelKey: 'Bleu nuit' },
]

type PlaygroundPreferencesProps = {
  selectedTheme: CurrentTheme
  onSelectTheme: (theme: CurrentTheme) => void
}

const PlaygroundPreferences = ({ selectedTheme, onSelectTheme }: PlaygroundPreferencesProps) => {
  const { i18n, t } = useTranslation()
  const theme = useTheme()
  const currentLanguage = i18n.language === 'en' ? 'en' : 'fr'

  return (
    <VStack
      bg="reverse"
      borderColor="border"
      borderWidth={1}
      borderRadius={22}
      p={18}
      gap={18}
      lightShadow
      testID="playground-preferences"
    >
      <HStack alignItems="center" gap={10}>
        <Box size={34} borderRadius={11} bg="lightGrey" center>
          <Feather name="sliders" size={16} color={theme.colors.primary} />
        </Box>
        <VStack>
          <Text title fontSize={17} lineHeight={21}>
            {t('playground.previewSettings')}
          </Text>
          <Text color="grey" fontSize={12} lineHeight={17}>
            {t('playground.previewSettingsDescription')}
          </Text>
        </VStack>
      </HStack>

      <VStack gap={9}>
        <Text color="darkGrey" fontSize={10} bold textTransform="uppercase">
          {t('language.appLanguage')}
        </Text>
        <HStack gap={8}>
          {(['fr', 'en'] as const).map(language => {
            const isSelected = currentLanguage === language
            return (
              <Pressable
                key={language}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => void i18n.changeLanguage(language)}
                style={{ flex: 1 }}
                testID={`playground-language-${language}`}
              >
                <Box
                  py={10}
                  px={12}
                  borderRadius={12}
                  borderColor={isSelected ? 'primary' : 'border'}
                  borderWidth={1}
                  bg={isSelected ? 'primary' : 'lightGrey'}
                  center
                >
                  <Text color={isSelected ? 'reverse' : 'default'} fontSize={13} bold>
                    {t(`offlineSetup.language.${language}`)}
                  </Text>
                </Box>
              </Pressable>
            )
          })}
        </HStack>
      </VStack>

      <VStack gap={9}>
        <Text color="darkGrey" fontSize={10} bold textTransform="uppercase">
          {t('settings.theme')}
        </Text>
        <HStack gap={8} wrap>
          {PLAYGROUND_THEME_OPTIONS.map(option => {
            const isSelected = selectedTheme === option.id
            const optionTheme = themes[option.id]
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={t(option.labelKey)}
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelectTheme(option.id)}
                style={{ width: '48%' }}
                testID={`playground-theme-${option.id}`}
              >
                <HStack
                  alignItems="center"
                  gap={9}
                  px={11}
                  py={10}
                  borderRadius={12}
                  borderColor={isSelected ? 'primary' : 'border'}
                  borderWidth={1}
                  bg="lightGrey"
                >
                  <Box
                    size={22}
                    borderRadius={7}
                    borderWidth={1}
                    borderColor="border"
                    backgroundColor={optionTheme.colors.lightGrey}
                    center
                  >
                    <Box size={8} borderRadius={4} backgroundColor={optionTheme.colors.primary} />
                  </Box>
                  <Text flex fontSize={12} bold numberOfLines={1}>
                    {t(option.labelKey)}
                  </Text>
                  {isSelected ? (
                    <Feather name="check" size={14} color={theme.colors.primary} />
                  ) : null}
                </HStack>
              </Pressable>
            )
          })}
        </HStack>
      </VStack>
    </VStack>
  )
}

export default PlaygroundPreferences
