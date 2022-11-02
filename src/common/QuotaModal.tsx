import Lottie from 'lottie-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Modal from 'react-native-modalbox'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { quotaModalAtom } from '../state/app'
import styled from '~styled'
import { LinkBox } from './Link'
import Box from './ui/Box'
import Button from './ui/Button'
import Text from './ui/Text'
import { useAtom } from 'jotai'
import useResetQuotaEveryDay from '~helpers/useResetQuotas'

const StylizedModal = styled(Modal)(({ theme }) => ({
  height: 400,
  width: '80%',
  maxWidth: 500,
  minWidth: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
}))

interface Props {
  navigation: NavigationStackProp<any>
}

const QuotaModal = ({ navigation }: Props) => {
  const { t } = useTranslation()
  useResetQuotaEveryDay()

  const isLightTheme = useSelector(
    (state: RootState) =>
      state.user.bible.settings.theme === 'default' ||
      state.user.bible.settings.theme === 'sepia'
  )
  const [showQuotaModal, setShowQuotaModal] = useAtom(quotaModalAtom)

  return (
    <StylizedModal
      isOpen={showQuotaModal}
      onClosed={() => setShowQuotaModal(false)}
      animationDuration={200}
      position="center"
      backdropOpacity={0.3}
      backdropPressToClose={true}
      swipeToClose={true}
    >
      <Box flex>
        <Box center flex>
          <Lottie
            autoPlay
            style={{
              width: 100,
              height: 100,
            }}
            source={
              isLightTheme
                ? require('../assets/images/lock.json')
                : require('../assets/images/lock-white.json')
            }
          />
        </Box>
        <Box px={20} pb={20}>
          <Text textAlign="center">{t('sponsor.quotaReached')}</Text>
        </Box>
        <Box p={20}>
          <Button
            onPress={() => {
              setShowQuotaModal(false)
              navigation.navigate('Premium')
            }}
          >
            {t('Devenir sponsor')}
          </Button>
          <LinkBox
            onPress={() => {
              setShowQuotaModal(false)
            }}
            p={20}
            pb={0}
          >
            <Text textAlign="center">{t('Non merci')}</Text>
          </LinkBox>
        </Box>
      </Box>
    </StylizedModal>
  )
}

export default withNavigation(QuotaModal)
