import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { Feather } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { CurrentTheme } from '~common/types'
import PlaygroundPreferences from './PlaygroundPreferences'
type PlaygroundLinkProps = {
  description: string
  eyebrow: string
  icon: React.ComponentProps<typeof Feather>['name']
  onPress: () => void
  title: string
}

const PlaygroundLink = ({ description, eyebrow, icon, onPress, title }: PlaygroundLinkProps) => {
  const stylingTheme = useStylingTheme()

  const theme = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <Box
        className="border-continuous overflow-hidden bg-reverse border-border border-[1px] rounded-[22px] p-[18px]"
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <HStack className="overflow-hidden border-continuous items-center gap-[14px]">
          <Box
            className="overflow-hidden border-continuous rounded-[15px] bg-primary items-center justify-center"
            style={{ width: 46, height: 46 }}
          >
            <Feather name={icon} size={21} color={theme.colors.reverse} />
          </Box>
          <VStack className="overflow-hidden border-continuous flex-[1] gap-[3px]">
            <Text className="text-primary text-[10px] font-bold uppercase">{eyebrow}</Text>
            <Text
              className="text-[19px] leading-[24px]"
              style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
            >
              {title}
            </Text>
          </VStack>
          <Feather name="chevron-right" size={21} color={theme.colors.tertiary} />
        </HStack>
        <Text className="text-grey text-[14px] leading-[21px] mt-[14px]">{description}</Text>
      </Box>
    </Pressable>
  )
}

type PlaygroundHomeProps = {
  selectedTheme: CurrentTheme
  onSelectTheme: (theme: CurrentTheme) => void
  onOpenAbelOnboarding: () => void
  onOpenOfflineSetup: () => void
  onOpenHTMLBenchmark: () => void
}

const PlaygroundHome = ({
  selectedTheme,
  onSelectTheme,
  onOpenAbelOnboarding,
  onOpenOfflineSetup,
  onOpenHTMLBenchmark,
}: PlaygroundHomeProps) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const contentWidth = Math.min(Math.max(width - 40, 1), 720)

  return (
    <Box className="overflow-hidden border-continuous flex-[1] bg-light-grey">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 32),
          paddingBottom: Math.max(insets.bottom, 32),
        }}
        showsVerticalScrollIndicator={false}
      >
        <VStack
          className="overflow-hidden border-continuous max-w-[100%] gap-[32px]"
          style={{ width: contentWidth }}
        >
          <VStack className="overflow-hidden border-continuous gap-[16px]">
            <HStack className="overflow-hidden border-continuous items-center gap-[9px]">
              <Box
                className="overflow-hidden border-continuous rounded-[5px] bg-secondary"
                style={{ width: 9, height: 9 }}
              />
              <Text className="text-dark-grey text-[11px] font-bold uppercase">
                {t('playground.badge')}
              </Text>
            </HStack>
            <VStack className="overflow-hidden border-continuous gap-[10px]">
              <Text
                className="text-[36px] leading-[42px]"
                style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
              >
                {t('playground.title')}
              </Text>
              <Text className="text-grey text-[16px] leading-[24px]">
                {t('playground.description')}
              </Text>
            </VStack>
          </VStack>

          <PlaygroundPreferences selectedTheme={selectedTheme} onSelectTheme={onSelectTheme} />

          <VStack className="overflow-hidden border-continuous gap-[12px]">
            <Text className="text-dark-grey text-[11px] font-bold uppercase">
              {t('playground.experiences')}
            </Text>
            <PlaygroundLink
              eyebrow="Performance mobile"
              title="HTML : Native / Expo DOM"
              description="Comparer les mêmes textes, leurs temps d’affichage et les pauses JavaScript."
              icon="activity"
              onPress={onOpenHTMLBenchmark}
            />
            <PlaygroundLink
              eyebrow={t('playground.abelEyebrow')}
              title={t('playground.abelTitle')}
              description={t('playground.abelDescription')}
              icon="compass"
              onPress={onOpenAbelOnboarding}
            />
            <PlaygroundLink
              eyebrow={t('playground.resourcesEyebrow')}
              title={t('playground.resourcesTitle')}
              description={t('playground.resourcesDescription')}
              icon="archive"
              onPress={onOpenOfflineSetup}
            />
          </VStack>
        </VStack>
      </ScrollView>
    </Box>
  )
}

export default PlaygroundHome
