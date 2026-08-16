import { useTranslation } from 'react-i18next'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box, { VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import useConnection from '~helpers/useConnection'

type Props = {
  onContinueOnline: () => void
  onPrepareOffline: () => void
}

const SetupChoice = ({
  description,
  icon,
  onPress,
  title,
}: {
  description: string
  icon: 'cloud' | 'download-cloud'
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
        row
        alignItems="center"
        gap={16}
        minHeight={108}
        p={18}
        borderRadius={22}
        borderWidth={1}
        borderColor="border"
        bg="reverse"
        opacity={pressed ? 0.76 : 1}
      >
        <Box size={48} borderRadius={24} bg="lightPrimary" center>
          <FeatherIcon name={icon} size={22} color="tertiary" />
        </Box>
        <Box flex gap={5}>
          <Text bold fontSize={16}>
            {title}
          </Text>
          <Text color="tertiary" fontSize={13} lineHeight={18}>
            {description}
          </Text>
        </Box>
        <FeatherIcon name="arrow-right" size={19} color="tertiary" />
      </Box>
    )}
  </Pressable>
)

const ResourceSetupChoice = ({ onContinueOnline, onPrepareOffline }: Props) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isConnected = useConnection()

  return (
    <VStack
      flex
      bg="lightGrey"
      px={22}
      paddingTop={Math.max(insets.top, 24) + 28}
      paddingBottom={Math.max(insets.bottom, 18)}
    >
      <Box flex justifyContent="center" maxWidth={520} width="100%" alignSelf="center">
        <Text title fontSize={30} lineHeight={37} textAlign="center">
          {t('offlineSetup.choice.title')}
        </Text>
        <Text color="tertiary" fontSize={15} lineHeight={22} textAlign="center" mt={12} mb={34}>
          {t('offlineSetup.choice.subtitle')}
        </Text>

        <VStack gap={14}>
          <SetupChoice
            icon="cloud"
            title={t('offlineSetup.choice.startNow')}
            description={t('offlineSetup.choice.startNowDescription')}
            onPress={onContinueOnline}
          />
          <SetupChoice
            icon="download-cloud"
            title={t('offlineSetup.choice.prepareOffline')}
            description={t('offlineSetup.choice.prepareOfflineDescription')}
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
