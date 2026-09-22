import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const MeditationsHome = () => {
  const { t } = useTranslation()
  const pushRoute = usePushRouteOnce()

  return (
    <Link
      onPress={() => pushRoute({ pathname: '/daily-reading' })}
      accessibilityLabel={t('home.meditations.title')}
      accessibilityHint={t('home.meditations.description')}
    >
      <Box className="bg-reverse rounded-[20px] p-[18px] flex-row items-center gap-[14px]">
        <Box className="w-[48px] h-[48px] rounded-[14px] bg-light-grey items-center justify-center">
          <FeatherIcon name="sunrise" size={24} color="primary" />
        </Box>
        <Box className="flex-1 gap-[5px]">
          <Text className="text-default font-bold text-[16px]">{t('home.meditations.title')}</Text>
          <Text className="text-grey text-[13px]">{t('home.meditations.description')}</Text>
        </Box>
        <FeatherIcon name="chevron-right" size={20} color="primary" />
      </Box>
    </Link>
  )
}

export default MeditationsHome
