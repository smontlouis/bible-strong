import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, Platform, Pressable, StyleSheet } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import StrobiAvatar from '~features/study-assistant/StrobiAvatar'
import { useStrobiReaction } from '~features/study-assistant/useStrobiReaction'
import { titleFontStyle } from '~themes/styleValues'
import { useTheme } from '~themes/ThemeProvider'

import Confetti from './Confetti'

function Welcome({ onAsk, onClose }: { onAsk?: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  // He wakes up, then celebrates: with Premium, Strobi no longer needs his rest.
  const [animation, react] = useStrobiReaction('celebrate', { animation: 'waking', ms: 1400 })

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    }
  }, [])

  // Android's back closes the welcome before it leaves the page. The Web has no such button.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => subscription.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
    >
      <Box
        className="flex-1 bg-canvas px-[28px]"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }}
      >
        <Box className="flex-1 items-center justify-center">
          <Pressable
            accessible={false}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              react('laughing')
            }}
          >
            <StrobiAvatar animation={animation} size={200} settleAfterMs={9000} />
          </Pressable>
          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            style={{ alignItems: 'center' }}
          >
            <Text
              accessibilityRole="header"
              className="text-[30px] text-center mt-[8px]"
              style={titleFontStyle(theme)}
            >
              {t('premiumPlan.welcome.title')}
            </Text>
            <Text className="text-[17px] leading-[24px] text-center mt-[12px]">
              {t('premiumPlan.welcome.body')}
            </Text>
          </Animated.View>
        </Box>
        <Animated.View entering={FadeInDown.delay(800).duration(400)} style={{ gap: 8 }}>
          {onAsk ? (
            <Button fullWidth onPress={onAsk}>
              {t('premiumPlan.welcome.ask')}
            </Button>
          ) : null}
          {onAsk ? (
            <TouchableBox onPress={onClose} className="items-center py-[12px]">
              <Text className="text-[15px] text-link font-semibold">
                {t('premiumPlan.welcome.close')}
              </Text>
            </TouchableBox>
          ) : (
            <Button fullWidth onPress={onClose}>
              {t('premiumPlan.welcome.done')}
            </Button>
          )}
        </Animated.View>
        <Confetti />
      </Box>
    </Animated.View>
  )
}

/**
 * The moment Premium starts: Strobi wakes up and celebrates under one shower of confetti, with
 * the success haptic. It leads to the assistant when this account can open it. It is a layer of
 * the Premium page, not a native modal: it appears while the store's sheet is still closing,
 * when iOS would refuse to present a modal over it.
 */
const PremiumWelcome = ({
  visible,
  onAsk,
  onClose,
}: {
  visible: boolean
  onAsk?: () => void
  onClose: () => void
}) => (visible ? <Welcome onAsk={onAsk} onClose={onClose} /> : null)

export default PremiumWelcome
