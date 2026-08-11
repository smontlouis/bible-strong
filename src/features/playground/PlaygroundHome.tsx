import { useTheme } from '@emotion/react'
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
      <Box bg="reverse" borderColor="border" borderWidth={1} borderRadius={22} p={18} lightShadow>
        <HStack alignItems="center" gap={14}>
          <Box size={46} borderRadius={15} bg="primary" center>
            <Feather name={icon} size={21} color={theme.colors.reverse} />
          </Box>
          <VStack flex={1} gap={3}>
            <Text color="primary" fontSize={10} bold textTransform="uppercase">
              {eyebrow}
            </Text>
            <Text title fontSize={19} lineHeight={24}>
              {title}
            </Text>
          </VStack>
          <Feather name="chevron-right" size={21} color={theme.colors.tertiary} />
        </HStack>
        <Text color="grey" fontSize={14} lineHeight={21} mt={14}>
          {description}
        </Text>
      </Box>
    </Pressable>
  )
}

type PlaygroundHomeProps = {
  selectedTheme: CurrentTheme
  onSelectTheme: (theme: CurrentTheme) => void
  onOpenAbelOnboarding: () => void
  onOpenOfflineSetup: () => void
}

const PlaygroundHome = ({
  selectedTheme,
  onSelectTheme,
  onOpenAbelOnboarding,
  onOpenOfflineSetup,
}: PlaygroundHomeProps) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const contentWidth = Math.min(Math.max(width - 40, 1), 720)

  return (
    <Box flex bg="lightGrey">
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
        <VStack width={contentWidth} maxWidth="100%" gap={32}>
          <VStack gap={16}>
            <HStack alignItems="center" gap={9}>
              <Box size={9} borderRadius={5} bg="secondary" />
              <Text color="darkGrey" fontSize={11} bold textTransform="uppercase">
                {t('playground.badge')}
              </Text>
            </HStack>
            <VStack gap={10}>
              <Text title fontSize={36} lineHeight={42}>
                {t('playground.title')}
              </Text>
              <Text color="grey" fontSize={16} lineHeight={24}>
                {t('playground.description')}
              </Text>
            </VStack>
          </VStack>

          <PlaygroundPreferences selectedTheme={selectedTheme} onSelectTheme={onSelectTheme} />

          <VStack gap={12}>
            <Text color="darkGrey" fontSize={11} bold textTransform="uppercase">
              {t('playground.experiences')}
            </Text>
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
