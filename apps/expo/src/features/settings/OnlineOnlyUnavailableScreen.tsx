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
    <SafeAreaBox className="overflow-hidden border-continuous flex-[1] bg-light-grey">
      <Header title={t(titleKey)} hasBackButton />
      <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center px-[28px]">
        <FeatherIcon name="cloud" size={56} color="primary" />
        <Text className="mt-[20px] text-[22px] font-bold text-center">
          {t('resource.web.onlineOnlyTitle')}
        </Text>
        <Text className="mt-[10px] text-tertiary text-center leading-[22px]">
          {t('resource.web.onlineOnlyDescription')}
        </Text>
        <Box className="overflow-hidden border-continuous mt-[24px]">
          <Button onPress={() => router.replace('/')}>{t('resource.web.backToBible')}</Button>
        </Box>
      </Box>
    </SafeAreaBox>
  )
}

export default OnlineOnlyUnavailableScreen
