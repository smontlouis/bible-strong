import styled from '@emotion/native'
import { useAtom } from 'jotai/react'
import Lottie from 'lottie-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Modal from 'react-native-modalbox'
import { withNavigation } from 'react-navigation'
import { NavigationStackProp } from 'react-navigation-stack'
import useResetQuotaEveryDay from '~helpers/useResetQuotas'
import { quotaModalAtom } from '../state/app'
import { LinkBox } from './Link'
import Box from './ui/Box'
import Button from './ui/Button'
import Text from './ui/Text'

const StylizedModal = styled(Modal)(({ theme }) => ({
  height: 360,
  width: '70%',
  maxWidth: 500,
  minWidth: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 30,
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

  const [showQuotaModal, setShowQuotaModal] = useAtom(quotaModalAtom)

  const getQuotaTraduction = () => {
    switch (showQuotaModal) {
      case 'daily':
        return 'sponsor.dailyQuotaReached'
      case 'tabs':
        return 'sponsor.tabsQuotaReached'
      default:
        return 'sponsor.quotaReached'
    }
  }

  return (
    <StylizedModal
      isOpen={Boolean(showQuotaModal)}
      onClosed={() => setShowQuotaModal(null)}
      animationDuration={200}
      position="center"
      backdropOpacity={0.3}
      backdropPressToClose={true}
      swipeToClose={true}
    >
      <Box flex py={10} px={20} center>
        <Box w={100} h={80} overflow="visible">
          <Lottie
            autoPlay
            style={{
              width: 130,
              height: 130,
              top: -10,
              left: -10,
              position: 'absolute',
            }}
            source={require('../assets/images/premium-icon.json')}
          />
        </Box>

        <Text fontSize={18} bold>
          {t('Devenez un sponsor !')}
        </Text>
        <Box my={20}>
          <Text fontSize={12}>{t(getQuotaTraduction())}</Text>
        </Box>
        <Box>
          <Button
            onPress={() => {
              setShowQuotaModal(null)
              navigation.navigate('Premium')
            }}
          >
            {t('Devenir sponsor')}
          </Button>
          <LinkBox
            onPress={() => {
              setShowQuotaModal(null)
            }}
            p={10}
            pb={0}
          >
            <Text textAlign="center" fontSize={12}>
              {t(
                showQuotaModal === 'daily' ? 'app.noIllWait' : 'app.noThankYou'
              )}
            </Text>
          </LinkBox>
        </Box>
      </Box>
    </StylizedModal>
  )
}

export default withNavigation(QuotaModal)
