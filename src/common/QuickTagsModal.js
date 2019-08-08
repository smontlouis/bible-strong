import React from 'react'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import AnimatedCircularProgress from '~common/AnimatedCircularProgress'
import { TouchableOpacity } from 'react-native-gesture-handler'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  alignItems: 'center',
  margin: 0,
  paddingBottom: 100
})

const WrapperIcon = styled(Box)(({ theme }) => ({
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
  elevation: 2
}))

const StyledIcon = styled(Icon.FontAwesome)(({ theme, isDisabled }) => ({
  color: 'rgb(210,210,210)'
}))

const QuickTagsModal = ({ theme, item, onClosed, setMultipleTagsItem }) => {
  const progressRef = React.useRef()

  React.useEffect(() => {
    if (item) {
      progressRef.current.animate(100, 3000)
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
      <TouchableOpacity
        onPress={() => {
          onClosed()
          setTimeout(() => {
            setMultipleTagsItem(item)
          }, 500)
        }}
      >

        <AnimatedCircularProgress
          ref={progressRef}
          size={60}
          width={5}
          fill={100}
          tintColor='#46DF4C'
          onAnimationComplete={onClosed}
          lineCap='round'
        >
          {
            () => (
              <WrapperIcon>
                <StyledIcon size={20} name='tags' />
              </WrapperIcon>
            )
          }
        </AnimatedCircularProgress>
      </TouchableOpacity>

    </StylizedModal>
  )
}

export default withTheme(QuickTagsModal)
