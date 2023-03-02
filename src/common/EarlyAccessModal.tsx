import styled from '@emotion/native'
import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Modal from 'react-native-modalbox'
import { withNavigation } from 'react-navigation'
import { useNavigation } from 'react-navigation-hooks'
import { earlyAccessModalAtom } from '../state/app'
import { LinkBox } from './Link'
import Box from './ui/Box'
import Button from './ui/Button'
import { IonIcon } from './ui/Icon'
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

const EarlyAccessModal = () => {
  const { t } = useTranslation()
  const navigation = useNavigation()

  const [showEarlyAccessModal, setShowEarlyAccessModal] = useAtom(
    earlyAccessModalAtom
  )

  return (
    <StylizedModal
      isOpen={Boolean(showEarlyAccessModal)}
      onClosed={() => setShowEarlyAccessModal(false)}
      animationDuration={200}
      position="center"
      backdropOpacity={0.3}
      backdropPressToClose={true}
      swipeToClose={true}
    >
      <Box flex py={10} px={20} center>
        <IonIcon name="time-outline" size={60} color="primary" />

        <Text fontSize={18} bold>
          {t('premium.earlyAccess')}
        </Text>
        <Box my={20}>
          <Text textAlign="center" fontSize={16}>
            {t('premium.earlyAccess.description')}
          </Text>
        </Box>
        <Box mt={10}>
          <Button
            onPress={() => {
              setShowEarlyAccessModal(false)
              navigation.navigate('Premium')
            }}
          >
            {t('Devenir sponsor')}
          </Button>
          <LinkBox
            onPress={() => {
              setShowEarlyAccessModal(false)
            }}
            p={10}
            pb={0}
          >
            <Text textAlign="center" fontSize={12}>
              {t('app.noIllWait')}
            </Text>
          </LinkBox>
        </Box>
      </Box>
    </StylizedModal>
  )
}

export default withNavigation(EarlyAccessModal)
