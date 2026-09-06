import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor, resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
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
  const stylingTheme = useStylingTheme()

  const { i18n, t } = useTranslation()
  const theme = useTheme()
  const currentLanguage = i18n.language === 'en' ? 'en' : 'fr'

  return (
    <VStack
      className="border-continuous overflow-hidden bg-reverse border-border border-[1px] rounded-[22px] p-[18px] gap-[18px]"
      testID="playground-preferences"
      style={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      <HStack className="overflow-hidden border-continuous items-center gap-[10px]">
        <Box
          className="overflow-hidden border-continuous rounded-[11px] bg-light-grey items-center justify-center"
          style={{ width: 34, height: 34 }}
        >
          <Feather name="sliders" size={16} color={theme.colors.primary} />
        </Box>
        <VStack className="overflow-hidden border-continuous">
          <Text
            className="text-[17px] leading-[21px]"
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('playground.previewSettings')}
          </Text>
          <Text className="text-grey text-[12px] leading-[17px]">
            {t('playground.previewSettingsDescription')}
          </Text>
        </VStack>
      </HStack>

      <VStack className="overflow-hidden border-continuous gap-[9px]">
        <Text className="text-dark-grey text-[10px] font-bold uppercase">
          {t('language.appLanguage')}
        </Text>
        <HStack className="overflow-hidden border-continuous gap-[8px]">
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
                  className={twMerge(
                    'overflow-hidden border-continuous',
                    twMerge(
                      isSelected ? 'bg-primary' : 'bg-light-grey',
                      isSelected ? 'border-primary' : 'border-border',
                      'overflow-hidden border-continuous py-[10px] px-[12px] rounded-[12px] border-[1px] items-center justify-center'
                    )
                  )}
                >
                  <Text
                    className={twMerge(
                      isSelected ? 'text-reverse' : 'text-default',
                      'text-[13px] font-bold'
                    )}
                  >
                    {t(`offlineSetup.language.${language}`)}
                  </Text>
                </Box>
              </Pressable>
            )
          })}
        </HStack>
      </VStack>

      <VStack className="overflow-hidden border-continuous gap-[9px]">
        <Text className="text-dark-grey text-[10px] font-bold uppercase">
          {t('settings.theme')}
        </Text>
        <HStack className="overflow-hidden border-continuous gap-[8px] flex-wrap">
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
                  className={twMerge(
                    'overflow-hidden border-continuous',
                    twMerge(
                      isSelected ? 'border-primary' : 'border-border',
                      'overflow-hidden border-continuous items-center gap-[9px] px-[11px] py-[10px] rounded-[12px] border-[1px] bg-light-grey'
                    )
                  )}
                >
                  <Box
                    className="border-continuous overflow-hidden rounded-[7px] border-[1px] border-border items-center justify-center"
                    style={{
                      backgroundColor: resolveThemeColor(
                        stylingTheme,
                        optionTheme.colors.lightGrey
                      ),
                      width: 22,
                      height: 22,
                    }}
                  >
                    <Box
                      className="overflow-hidden border-continuous rounded-[4px]"
                      style={{
                        backgroundColor: resolveThemeColor(
                          stylingTheme,
                          optionTheme.colors.primary
                        ),
                        width: 8,
                        height: 8,
                      }}
                    />
                  </Box>
                  <Text className="flex-[1] text-[12px] font-bold" numberOfLines={1}>
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
