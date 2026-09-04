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
      <Box gap={4} minHeight={142} py={16} opacity={pressed ? 0.76 : 1} alignItems="center">
        <Image source={illustration} style={{ width: 140, height: 140 }} resizeMode="contain" />
        <Box row alignItems="center" gap={10}>
          <Box gap={4} alignItems="center" justifyContent="center">
            <Text
              fontSize={22}
              lineHeight={28}
              textAlign="center"
              style={{ fontFamily: 'Literata Book' }}
            >
              {title}
            </Text>
            <Text color="tertiary" textAlign="center" fontSize={14} lineHeight={20}>
              {description}
            </Text>
          </Box>
        </Box>
      </Box>
    )}
  </Pressable>
)

const ResourceSetupChoice = ({ onContinueOnline, onPrepareOffline }: Props) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const viewport = useWindowDimensions()
  const isConnected = useConnection()
  const contentWidth = Math.min(350, viewport.width - 40)

  return (
    <VStack flex bg="lightGrey" paddingBottom={Math.max(insets.bottom, 18)}>
      <Box
        flex
        width={contentWidth}
        alignSelf="center"
        paddingTop={insets.top + OFFLINE_SETUP_HEADER_TOP_OFFSET}
      >
        <Text title fontSize={40} lineHeight={42}>
          {t('offlineSetup.choice.title')}
        </Text>

        <VStack mt={72}>
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
          <Box row center gap={8} mt={22}>
            <FeatherIcon name="wifi-off" size={16} color="tertiary" />
            <Text color="tertiary" fontSize={12} textAlign="center">
              {t('offlineSetup.choice.offlineNotice')}
            </Text>
          </Box>
        )}
      </Box>
    </VStack>
  )
}

export default ResourceSetupChoice
