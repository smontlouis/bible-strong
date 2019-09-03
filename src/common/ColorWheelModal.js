import React, { useState } from 'react'
import Modal from 'react-native-modal'
import colorsys from 'colorsys'
import { useDispatch } from 'react-redux'

import styled from '@emotion/native'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import { ColorWheel } from '~common/ColorWheel'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { changeColor } from '~redux/modules/user'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  height: 260 + getBottomSpace(),
  display: 'flex',
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace()
}))

const ColorSquare = styled.View(({ color, size }) => ({
  width: size,
  height: size,
  borderRadius: size / 4,
  backgroundColor: color,
  marginRight: 10
}))

const SelectBlockModal = ({ currentColor, onClosed }) => {
  const [chosenColor, setChosenColor] = useState(currentColor)
  const dispatch = useDispatch()

  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={!!currentColor}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}>
      <Container>
        {currentColor && (
          <>
            <Box height={200} center>
              <ColorWheel
                initialColor={currentColor.color}
                onColorChange={color => setChosenColor(colorsys.hsv2Hex(color))}
                style={{ width: 200, height: 200 }}
                thumbStyle={{ height: 30, width: 30, borderRadius: 30 }}
              />
            </Box>
            <Box row padding={10} center>
              <ColorSquare size={30} color={chosenColor} onPress={() => {}} />
              <Text bold marginRight={20}>
                Couleur {currentColor.number}
              </Text>
              <Button
                title="Valider"
                onPress={() => {
                  dispatch(
                    changeColor({
                      name: currentColor.name,
                      color: chosenColor
                    })
                  )
                  onClosed()
                }}
              />
            </Box>
          </>
        )}
      </Container>
    </StylizedModal>
  )
}

export default SelectBlockModal
