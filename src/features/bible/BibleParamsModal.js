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

const Container = styled.View(({ theme }) => ({
  width: 200,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  alignItems: 'stretch',
  justifyContent: 'space-between'
}))

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

const textDisplayToString = {
  inline: 'Continu',
  block: 'À la ligne'
}

const themeToString = {
  default: 'Mode jour',
  dark: 'Mode nuit'
}

const BibleParamsModal = ({
  isOpen,
  onClosed,
  setSettingsAlignContent,
  setSettingsTextDisplay,
  increaseSettingsFontSizeScale,
  decreaseSettingsFontSizeScale,
  setSettingsTheme,
  settings: {
    alignContent,
    fontSizeScale,
    textDisplay,
    theme
  }
}) => {
  return (
    <StylizedModal
      isOpen={isOpen}
      onClosed={onClosed}
      animationDuration={200}
      position='top'
      entry='top'
      swipeToClose={false}
      backdropOpacity={0.1}
    >
      <Container>
        <HalfContainer border>
          <TouchableIcon
            isSelected={alignContent === 'justify'}
            name='align-justify'
            onPress={() => setSettingsAlignContent('justify')}
          />
          <Text bold>{alignContentToString[alignContent]}</Text>
          <TouchableIcon
            isSelected={alignContent === 'left'}
            name='align-left'
            onPress={() => setSettingsAlignContent('left')}
          />
        </HalfContainer>
        <HalfContainer border>
          <TouchableIcon
            name='type'
            size={15}
            onPress={() => decreaseSettingsFontSizeScale()}
          />
          <Text bold>{`${100 + fontSizeScale * 10}%`}</Text>
          <TouchableIcon
            name='type'
            onPress={() => increaseSettingsFontSizeScale()}
          />
        </HalfContainer>
        <HalfContainer>
          <TouchableIcon
            isSelected={textDisplay === 'inline'}
            name='menu'
            onPress={() => setSettingsTextDisplay('inline')}
          />
          <Text bold>{textDisplayToString[textDisplay]}</Text>
          <TouchableIcon
            isSelected={textDisplay === 'block'}
            name='list'
            onPress={() => setSettingsTextDisplay('block')}
          />
        </HalfContainer>
        <HalfContainer>
          <TouchableIcon
            isSelected={theme === 'default'}
            name='sun'
            onPress={() => setSettingsTheme('default')}
          />
          <Text bold>{themeToString[theme]}</Text>
          <TouchableIcon
            isSelected={theme === 'dark'}
            name='moon'
            onPress={() => setSettingsTheme('dark')}
          />
        </HalfContainer>

      </Container>
    </StylizedModal>
  )
}

export default BibleParamsModal
