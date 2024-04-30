import colorsys from 'colorsys'
import React, { useEffect, useState } from 'react'
import Modal from 'react-native-modal'
import { useDispatch } from 'react-redux'

import styled from '@emotion/native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ColorPicker from '~common/ColorPicker'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { changeColor } from '~redux/modules/user'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0,
})

const Container = styled.View(({ theme }) => {
  const insets = useSafeAreaInsets()
  return {
    height: 260 + insets.bottom,
    display: 'flex',
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
    maxWidth: 600,
    backgroundColor: theme.colors.reverse,
    borderRadius: 3,
    shadowColor: theme.colors.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
    paddingBottom: insets.bottom,
  }
})

const ColorSquare = styled.View(({ color, size }) => ({
  width: size,
  height: size,
  borderRadius: size / 4,
  backgroundColor: color,
  marginRight: 10,
}))

const SelectBlockModal = ({ currentColor = {}, onClosed, t }) => {
  const [chosenColor, setChosenColor] = useState(null)
  const dispatch = useDispatch()

  useEffect(() => {
    if (currentColor) {
      setChosenColor(currentColor.color)
    }
  }, [currentColor])

  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={!!currentColor}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
    >
      <Container>
        {!!chosenColor && (
          <>
            <Box height={200}>
              <ColorPicker
                onChangeColor={(...color) =>
                  setChosenColor(colorsys.hslToHex(...color))
                }
              />
            </Box>
            <Box row padding={10} center>
              <ColorSquare size={30} color={chosenColor} onPress={() => {}} />
              <Text bold marginRight={20}>
                Couleur {currentColor.number}
              </Text>
              <Button
                small
                onPress={() => {
                  dispatch(
                    changeColor({
                      name: currentColor.name,
                      color: chosenColor,
                    })
                  )
                  onClosed()
                }}
              >
                {t('Valider')}
              </Button>
            </Box>
          </>
        )}
      </Container>
    </StylizedModal>
  )
}

export default SelectBlockModal
