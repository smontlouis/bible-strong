import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useTranslation } from 'react-i18next'
import { Image, Pressable, useWindowDimensions } from 'react-native'
import type { ImageSourcePropType } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useConnection from '~helpers/useConnection'
import { OFFLINE_SETUP_HEADER_TOP_OFFSET } from './offlineSetupPresentation'
type Props = {
  onContinueOnline: () => void
  onPrepareOffline: () => void
}

const SetupChoice = ({
  description,
  illustration,
  onPress,
  title,
}: {
  description: string
  illustration: ImageSourcePropType
  onPress: () => void
  title: string
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${description}`}
    onPress={onPress}
  >
    {({ pressed }) => (
      <Box
        className="overflow-hidden border-continuous gap-[4px] min-h-[142px] py-[16px] items-center"
        style={{ opacity: pressed ? 0.76 : 1 }}
      >
        <Image source={illustration} style={{ width: 140, height: 140 }} resizeMode="contain" />
        <Box className="overflow-hidden border-continuous flex-row items-center gap-[10px]">
          <Box className="overflow-hidden border-continuous gap-[4px] items-center justify-center">
            <Text
              className="text-[22px] leading-[28px] text-center"
              style={{ fontFamily: 'Literata Book' }}
            >
              {title}
            </Text>
            <Text className="text-tertiary text-center text-[14px] leading-[20px]">
              {description}
            </Text>
          </Box>
        </Box>
      </Box>
    )}
  </Pressable>
)

const ResourceSetupChoice = ({ onContinueOnline, onPrepareOffline }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const viewport = useWindowDimensions()
  const isConnected = useConnection()
  const contentWidth = Math.min(350, viewport.width - 40)

  return (
    <VStack
      className="overflow-hidden border-continuous flex-[1] bg-light-grey"
      style={{ paddingBottom: Math.max(insets.bottom, 18) }}
    >
      <Box
        className="overflow-hidden border-continuous flex-[1] self-center"
        style={{ paddingTop: insets.top + OFFLINE_SETUP_HEADER_TOP_OFFSET, width: contentWidth }}
      >
        <Text
          className="text-[40px] leading-[42px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {t('offlineSetup.choice.title')}
        </Text>

        <VStack className="overflow-hidden border-continuous mt-[72px]">
          <SetupChoice
            title={t('offlineSetup.choice.startNow')}
            description={t('offlineSetup.choice.startNowDescription')}
            illustration={require('../../assets/images/onboarding/online-choice.png')}
            onPress={onContinueOnline}
          />
          <SetupChoice
            title={t('offlineSetup.choice.prepareOffline')}
            description={t('offlineSetup.choice.prepareOfflineDescription')}
            illustration={require('../../assets/images/onboarding/offline-choice.png')}
            onPress={onPrepareOffline}
          />
        </VStack>

        {!isConnected && (
          <Box className="overflow-hidden border-continuous flex-row items-center justify-center gap-[8px] mt-[22px]">
            <FeatherIcon name="wifi-off" size={16} color="tertiary" />
            <Text className="text-tertiary text-[12px] text-center">
              {t('offlineSetup.choice.offlineNotice')}
            </Text>
          </Box>
        )}
      </Box>
    </VStack>
  )
}

export default ResourceSetupChoice
