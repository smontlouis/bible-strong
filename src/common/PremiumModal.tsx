import React from 'react'
import Modal from 'react-native-modalbox'
import styled from '~styled'
import Lottie from 'lottie-react-native'
import Box from './ui/Box'
import Text from './ui/Text'
import { Paragraph } from 'react-native-paper'
import { NavigationStackProp } from 'react-navigation-stack'
import Button from './ui/Button'
import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { useGlobalContext } from '~helpers/globalContext'
import { withNavigation } from 'react-navigation'
import { LinkBox } from './Link'

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

const PremiumModal = ({ navigation }: Props) => {
  const isLightTheme = useSelector(
    (state: RootState) =>
      state.user.bible.settings.theme === 'default' ||
      state.user.bible.settings.theme === 'sepia'
  )
  const {
    premiumModal: [showPremiumModal, setShowPremiumModal],
  } = useGlobalContext()

  return (
    <StylizedModal
      isOpen={showPremiumModal}
      onClosed={() => setShowPremiumModal(false)}
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
              width: '100%',
              height: 280,
            }}
            source={
              isLightTheme
                ? require('../assets/images/lock.json')
                : require('../assets/images/lock-white.json')
            }
          />
        </Box>
        <Box px={20} pb={20}>
          <Text textAlign="center">
            {
              "Cette fonctionnalité est premium,\n vous pouvez l'essayez gratuitement pendant 7 jours !"
            }
          </Text>
        </Box>
        <Box p={20}>
          <Button
            onPress={() => {
              setShowPremiumModal(false)
              navigation.navigate('Premium')
            }}
          >
            Essai gratuit
          </Button>
          <LinkBox
            onPress={() => {
              setShowPremiumModal(false)
            }}
            p={20}
            pb={0}
          >
            <Text textAlign="center">Non merci</Text>
          </LinkBox>
        </Box>
      </Box>
    </StylizedModal>
  )
}

export default withNavigation(PremiumModal)
