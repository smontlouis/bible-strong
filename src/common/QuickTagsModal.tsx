import styled from '@emotion/native'
import { withTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import Modal from 'react-native-modal'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const LinkBox = Box.withComponent(Link)

import { useTranslation } from 'react-i18next'
import AnimatedCircularProgress from '~common/AnimatedCircularProgress'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

const StylizedModal = styled(Modal)(({ theme }) => ({
  justifyContent: 'flex-end',
  alignItems: 'center',
  margin: 0,
  paddingBottom: 100 + useSafeAreaInsets().bottom,
}))

const WrapperIcon = styled.TouchableOpacity(({ theme }) => ({
  width: 50,
  height: 50,
  borderRadius: 25,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: '#F9F9F9',
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
}))

const StyledIcon = styled(Icon.FontAwesome)(({ theme, isDisabled }) => ({
  color: 'rgb(210,210,210)',
}))

const QuickTagsModal = ({ theme, item, onClosed, setMultipleTagsItem }) => {
  const progressRef = React.useRef()
  const { t } = useTranslation()

  React.useEffect(() => {
    if (item) {
      progressRef.current.animate(100, 5000)
    }
  }, [item])

  return (
    <StylizedModal
      isVisible={!!item}
      backdropOpacity={0.1}
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
      avoidKeyboard
    >
      <AnimatedCircularProgress
        ref={progressRef}
        size={60}
        width={5}
        fill={100}
        tintColor="#46DF4C"
        onAnimationComplete={onClosed}
        lineCap="round"
      >
        {() => (
          <WrapperIcon
            onPress={() => {
              onClosed()
              setTimeout(() => {
                setMultipleTagsItem(item)
              }, 500)
            }}
          >
            <StyledIcon size={20} name="tags" />
          </WrapperIcon>
        )}
      </AnimatedCircularProgress>
      <LinkBox
        bg="grey"
        lightShadow
        rounded
        p={5}
        mt={10}
        onPress={() => {
          onClosed()
          setTimeout(() => {
            setMultipleTagsItem(item)
          }, 500)
        }}
      >
        <Text color="reverse" fontSize={14}>
          {t('Ajouter un tag')}
        </Text>
      </LinkBox>
    </StylizedModal>
  )
}

export default withTheme(QuickTagsModal)
