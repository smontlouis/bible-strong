import React from 'react'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import TouchableIcon from './TouchableIcon'

const StylizedModal = styled(Modal)({
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: 100
})

const Container = styled.View({
  width: 200,
  backgroundColor: 'white',
  borderRadius: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  justifyContent: 'space-between'
})

const HalfContainer = styled.View(({ border, theme }) => ({
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  justifyContent: 'space-around',
  alignItems: 'center',
  height: 60
}))

const alignContentToString = {
  left: 'Gauche',
  justify: 'Justifier'
}

const BibleParamsModal = ({
  isOpen,
  onClosed,
  setSettingsAlignContent,
  settings: {
    alignContent
  }
}) => {
  return (
    <StylizedModal
      isOpen={isOpen}
      onClosed={onClosed}
      animationDuration={200}
      position='top'
      entry='top'
      backdropOpacity={0.1}
    >
      <Container>
        <HalfContainer border>
          <TouchableIcon
            isSelected={alignContent === 'left'}
            name='align-left'
            onPress={() => setSettingsAlignContent('left')}
          />
          <Text>{alignContentToString[alignContent]}</Text>
          <TouchableIcon
            isSelected={alignContent === 'justify'}
            name='align-justify'
            onPress={() => setSettingsAlignContent('justify')}
          />
        </HalfContainer>
        <HalfContainer border />
        <HalfContainer />

      </Container>
    </StylizedModal>
  )
}

export default BibleParamsModal
