import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { titleFontStyle } from '~themes/styleValues'
import { useTranslation } from 'react-i18next'
import { Image, Pressable, ScrollView, useWindowDimensions } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useConnection from '~helpers/useConnection'
import OnboardingStrobi from './abel/OnboardingStrobi'
import { tapHaptic } from './onboardingHaptics'
import { OFFLINE_SETUP_HEADER_TOP_OFFSET } from './offlineSetupPresentation'

type Props = {
  onContinueOnline: () => void
  onPrepareOffline: () => void
}

const STROBI_SIZE = 72

const SetupChoice = ({
  fact,
  illustration,
  onPress,
  recommended = false,
  title,
}: {
  fact: string
  illustration: ImageSourcePropType
  onPress: () => void
  recommended?: boolean
  title: string
}) => {
  const { t } = useTranslation()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${fact}`}
      onPress={() => {
        tapHaptic()
        onPress()
      }}
    >
      {({ pressed }) => (
        <Card
          className="flex-row items-center gap-[14px] py-[14px] pl-[10px] pr-[16px]"
          style={{
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          }}
        >
          <Image source={illustration} style={{ width: 92, height: 92 }} resizeMode="contain" />
          <VStack className="flex-1 gap-[4px]">
            <HStack className="flex-wrap items-center gap-x-[8px] gap-y-[4px]">
              <Text className="text-[21px] leading-[27px]" style={{ fontFamily: 'Literata Book' }}>
                {title}
              </Text>
              {recommended && (
                <Box className="bg-light-primary rounded-full px-[9px] py-[3px]">
                  <Text className="text-link text-[12px] font-bold">
                    {t('offlineSetup.choice.recommended')}
                  </Text>
                </Box>
              )}
            </HStack>
            <Text className="text-tertiary text-[14px] leading-[19px]">{fact}</Text>
          </VStack>
          <FeatherIcon name="chevron-right" size={20} color="tertiary" />
        </Card>
      )}
    </Pressable>
  )
}

/** The question, said by Strobi in a bubble beside it. */
const StrobiQuestion = ({ text }: { text: string }) => {
  const stylingTheme = useStylingTheme()
  return (
    <Box
      className="bg-reverse rounded-[16px] px-[16px] py-[12px]"
      style={{ borderBottomLeftRadius: radii.mark, ...floatingShadow }}
    >
      <Text
        accessibilityRole="header"
        className="text-[24px] leading-[28px]"
        style={titleFontStyle(stylingTheme)}
      >
        {text}
      </Text>
    </Box>
  )
}

/**
 * The end of the onboarding: start online now, or choose what to keep on the phone first. Strobi,
 * the guide of the onboarding, asks the question and looks at the recommended way.
 */
const ResourceSetupChoice = ({ onContinueOnline, onPrepareOffline }: Props) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const viewport = useWindowDimensions()
  const isConnected = useConnection()
  const reduceMotion = useReducedMotion()
  const contentWidth = Math.min(350, viewport.width - 40)
  const entering = (delay: number) =>
    reduceMotion ? undefined : FadeInUp.duration(420).delay(delay).springify()

  return (
    // A small screen scrolls. A tall one shows the question and its two answers a little above
    // its middle: the bottom keeps more room than the top.
    <ScrollView
      className="flex-1 bg-light-grey"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: insets.top + OFFLINE_SETUP_HEADER_TOP_OFFSET,
        paddingBottom: Math.max(insets.bottom, 18) + Math.round(viewport.height * 0.12),
      }}
      showsVerticalScrollIndicator={false}
    >
      <Box style={{ width: contentWidth }}>
        <Animated.View entering={entering(0)}>
          <HStack className="items-end gap-[10px]">
            <Box style={{ width: STROBI_SIZE, height: STROBI_SIZE }}>
              {/* Down, at the recommended way. */}
              <OnboardingStrobi state="curious" lookAt={[0.15, -0.75]} size={STROBI_SIZE} />
            </Box>
            <Box className="mb-[34px] flex-1">
              <StrobiQuestion text={t('offlineSetup.choice.title')} />
            </Box>
          </HStack>
        </Animated.View>

        <VStack className="mt-[32px] gap-[12px]">
          <Animated.View entering={entering(120)}>
            <SetupChoice
              title={t('offlineSetup.choice.startNow')}
              fact={t('offlineSetup.choice.startNowDescription')}
              illustration={require('../../assets/images/onboarding/online-choice.png')}
              onPress={onContinueOnline}
              recommended
            />
          </Animated.View>
          <Animated.View entering={entering(220)}>
            <SetupChoice
              title={t('offlineSetup.choice.prepareOffline')}
              fact={t('offlineSetup.choice.prepareOfflineDescription')}
              illustration={require('../../assets/images/onboarding/offline-choice.png')}
              onPress={onPrepareOffline}
            />
          </Animated.View>
        </VStack>

        <Animated.View entering={entering(320)}>
          <Text className="text-tertiary mt-[18px] text-center text-[13px] leading-[18px]">
            {t('offlineSetup.choice.later')}
          </Text>
          {!isConnected && (
            <Box className="overflow-hidden border-continuous flex-row items-center justify-center gap-[8px] mt-[14px]">
              <FeatherIcon name="wifi-off" size={16} color="tertiary" />
              <Text className="text-tertiary text-[12px] text-center">
                {t('offlineSetup.choice.offlineNotice')}
              </Text>
            </Box>
          )}
        </Animated.View>
      </Box>
    </ScrollView>
  )
}

export default ResourceSetupChoice
