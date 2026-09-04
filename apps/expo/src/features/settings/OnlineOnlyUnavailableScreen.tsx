import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'

import Header from '~common/Header'
import Box, { SafeAreaBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

const OnlineOnlyUnavailableScreen = ({ titleKey }: { titleKey: string }) => {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <SafeAreaBox flex bg="lightGrey">
      <Header title={t(titleKey)} hasBackButton />
      <Box flex center px={28}>
        <FeatherIcon name="cloud" size={56} color="primary" />
        <Text mt={20} fontSize={22} bold textAlign="center">
          {t('resource.web.onlineOnlyTitle')}
        </Text>
        <Text mt={10} color="tertiary" textAlign="center" lineHeight={22}>
          {t('resource.web.onlineOnlyDescription')}
        </Text>
        <Box mt={24}>
          <Button onPress={() => router.replace('/')}>{t('resource.web.backToBible')}</Button>
        </Box>
      </Box>
    </SafeAreaBox>
  )
}

export default OnlineOnlyUnavailableScreen
