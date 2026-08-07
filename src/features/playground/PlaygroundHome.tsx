import { useTheme } from '@emotion/react'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Pressable, ScrollView, useWindowDimensions } from 'react-native'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { Theme } from '~themes'

type PlaygroundCardProps = {
  eyebrow: string
  title: string
  description: string
  icon: ComponentProps<typeof Feather>['name']
  accent: keyof Theme['colors']
  selected: boolean
  onPress: () => void
}

const PlaygroundCard = ({
  eyebrow,
  title,
  description,
  icon,
  accent,
  selected,
  onPress,
}: PlaygroundCardProps) => {
  const theme = useTheme()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
    >
      <Box
        bg="reverse"
        borderColor={selected ? 'primary' : 'border'}
        borderWidth={selected ? 2 : 1}
        borderRadius={22}
        p={18}
        lightShadow
      >
        <HStack alignItems="center" gap={12}>
          <Box size={44} borderRadius={14} backgroundColor={theme.colors[accent]} center>
            <Feather name={icon} size={20} color={theme.colors.reverse} />
          </Box>
          <VStack flex={1}>
            <Text color="darkGrey" fontSize={11} bold textTransform="uppercase">
              {eyebrow}
            </Text>
            <Text title fontSize={19} mt={3}>
              {title}
            </Text>
          </VStack>
          <Feather
            name={selected ? 'check' : 'arrow-up-right'}
            size={19}
            color={selected ? theme.colors.primary : theme.colors.tertiary}
          />
        </HStack>
        <Text color="grey" fontSize={14} lineHeight={21} mt={14}>
          {description}
        </Text>
      </Box>
    </Pressable>
  )
}

type PlaygroundHomeProps = {
  onReplay: () => void
}

const PlaygroundHome = ({ onReplay }: PlaygroundHomeProps) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const [selectedWorkspace, setSelectedWorkspace] = useState<'abel' | 'design'>('abel')
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const contentWidth = Math.min(width - 40, 720)

  return (
    <Box flex bg="lightGrey" pt={insets.top}>
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: Math.max(insets.bottom, 32),
        }}
        showsVerticalScrollIndicator={false}
      >
        <VStack width={contentWidth} maxWidth="100%" gap={24}>
          <HStack alignItems="center" justifyContent="space-between">
            <HStack alignItems="center" gap={9}>
              <Box size={10} borderRadius={5} bg="secondary" />
              <Text color="darkGrey" fontSize={12} bold textTransform="uppercase">
                {t('playground.badge')}
              </Text>
            </HStack>
            <Box bg="lightPrimary" borderRadius={14} px={11} py={6}>
              <Text color="primary" fontSize={11} bold>
                {t('playground.development')}
              </Text>
            </Box>
          </HStack>

          <VStack gap={10}>
            <Text title fontSize={34} lineHeight={40}>
              {t('playground.title')}
            </Text>
            <Text color="grey" fontSize={17} lineHeight={25}>
              {t('playground.description')}
            </Text>
          </VStack>

          <Box bg="reverse" borderRadius={24} p={20} borderWidth={1} borderColor="border">
            <HStack alignItems="center" gap={12}>
              <Box size={42} borderRadius={14} bg="lightPrimary" center>
                <Feather name="zap" size={20} color={theme.colors.primary} />
              </Box>
              <VStack flex={1} gap={2}>
                <Text bold fontSize={16}>
                  {t('playground.activeTitle')}
                </Text>
                <Text color="grey" fontSize={13} lineHeight={19}>
                  {t('playground.activeDescription')}
                </Text>
              </VStack>
            </HStack>
          </Box>

          <VStack gap={12}>
            <Text color="darkGrey" fontSize={12} bold textTransform="uppercase">
              {t('playground.workspaces')}
            </Text>
            <PlaygroundCard
              eyebrow={t('playground.abelEyebrow')}
              title={t('playground.abelTitle')}
              description={t('playground.abelDescription')}
              icon="compass"
              accent="primary"
              selected={selectedWorkspace === 'abel'}
              onPress={() => setSelectedWorkspace('abel')}
            />
            <PlaygroundCard
              eyebrow={t('playground.designEyebrow')}
              title={t('playground.designTitle')}
              description={t('playground.designDescription')}
              icon="layers"
              accent="secondary"
              selected={selectedWorkspace === 'design'}
              onPress={() => setSelectedWorkspace('design')}
            />
          </VStack>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('playground.replay')}
            onPress={onReplay}
            style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          >
            <HStack alignItems="center" justifyContent="center" gap={8}>
              <Feather name="rotate-ccw" size={15} color={theme.colors.primary} />
              <Text color="primary" fontSize={13} bold>
                {t('playground.replay')}
              </Text>
            </HStack>
          </Pressable>

          <Box px={4}>
            <Text color="darkGrey" fontSize={12} textAlign="center" lineHeight={18}>
              {t('playground.fullAppHint')}
            </Text>
          </Box>
        </VStack>
      </ScrollView>
    </Box>
  )
}

export default PlaygroundHome
