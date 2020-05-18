import React from 'react'
import { Modalize } from 'react-native-modalize'
import Lottie from 'lottie-react-native'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import Button from '~common/ui/Button'

interface Props {
  modalRef: React.RefObject<Modalize>
  isPlanCompleted: boolean
}

const SuccessModal = ({ modalRef, isPlanCompleted }: Props) => {
  return (
    <Modalize
      ref={modalRef}
      handleStyle={{
        opacity: 0,
      }}
      overlayStyle={{
        backgroundColor: 'rgba(0,0,0,0.2)',
      }}
      modalStyle={{
        backgroundColor: 'transparent',
        elevation: 0,
        maxWidth: 600,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      adjustToContentHeight
      openAnimationConfig={{
        timing: { duration: 500 },
        spring: { friction: 7, tension: 20 },
      }}
    >
      <Box
        flex={1}
        justifyContent="flex-end"
        paddingVertical={40}
        paddingHorizontal={20}
      >
        <Box center>
          <Lottie
            autoPlay
            style={{
              width: '100%',
              height: 280,
            }}
            source={
              isPlanCompleted
                ? require('../../../assets/images/crown.json')
                : require('../../../assets/images/medal.json')
            }
          />
        </Box>
        <Box
          backgroundColor="reverse"
          lightShadow
          borderRadius={30}
          marginBottom={30}
          padding={20}
        >
          {isPlanCompleted ? (
            <>
              <Paragraph fontFamily="text" textAlign="center" bold>
                Félicitations !!
              </Paragraph>
              <Paragraph scale={-1} fontFamily="text" textAlign="center">
                Vous avez complété ce plan !
              </Paragraph>
            </>
          ) : (
            <>
              <Paragraph fontFamily="text" textAlign="center" bold>
                Félicitations !
              </Paragraph>
              <Paragraph scale={-1} fontFamily="text" textAlign="center">
                Vous venez de finir votre lecture.
              </Paragraph>
            </>
          )}
        </Box>
        <Button fullWidth onPress={() => modalRef?.current?.close()}>
          Continuer
        </Button>
      </Box>
    </Modalize>
  )
}

export default SuccessModal
