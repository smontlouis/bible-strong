import React from 'react'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import SnackBar from '~common/SnackBar'
import { getIfDatabaseExists } from '~helpers/database'
import IconShortPress from '~assets/images/IconShortPress'
import IconLongPress from '~assets/images/IconLongPress'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import SvgIcon from './SvgIcon'
import ColorWheelIcon from '~common/ColorWheelIcon'

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

const pressToString = {
  shortPress: 'Strong appui court',
  longPress: 'Strong appui long'
}

const notesDisplayToString = {
  inline: 'Note à la ligne',
  block: 'Note en icone'
}

const commentsDisplayToString = {
  false: 'Sans comm.',
  true: 'Avec comm.'
}

const BibleParamsModal = ({
  isOpen,
  onClosed,
  setSettingsAlignContent,
  setSettingsTextDisplay,
  setSettingsPress,
  increaseSettingsFontSizeScale,
  decreaseSettingsFontSizeScale,
  setSettingsTheme,
  setSettingsNotesDisplay,
  setSettingsCommentaires,
  navigation,
  settings: {
    alignContent,
    fontSizeScale,
    textDisplay,
    theme,
    press,
    notesDisplay,
    commentsDisplay
  }
}) => {
  const onOpenCommentaire = async () => {
    const exists = await getIfDatabaseExists('commentaires-mhy')

    if (!exists) {
      SnackBar.show('Téléchargez la base de commentaires Matthew Henry')
      navigation.navigate('Downloads')
      return
    }

    setSettingsCommentaires(true)
  }

  return (
    <StylizedModal
      isOpen={isOpen}
      onClosed={onClosed}
      animationDuration={200}
      position="top"
      entry="top"
      swipeToClose={false}
      backdropOpacity={0.1}>
      <Container>
        <HalfContainer border>
          <TouchableIcon
            isSelected={alignContent === 'justify'}
            name="align-justify"
            onPress={() => setSettingsAlignContent('justify')}
          />
          <Text bold>{alignContentToString[alignContent]}</Text>
          <TouchableIcon
            isSelected={alignContent === 'left'}
            name="align-left"
            onPress={() => setSettingsAlignContent('left')}
          />
        </HalfContainer>
        <HalfContainer border>
          <TouchableIcon name="type" size={15} onPress={() => decreaseSettingsFontSizeScale()} />
          <Text bold>{`${100 + fontSizeScale * 10}%`}</Text>
          <TouchableIcon name="type" onPress={() => increaseSettingsFontSizeScale()} />
        </HalfContainer>
        <HalfContainer border>
          <TouchableIcon
            isSelected={textDisplay === 'inline'}
            name="menu"
            onPress={() => setSettingsTextDisplay('inline')}
          />
          <Text bold>{textDisplayToString[textDisplay]}</Text>
          <TouchableIcon
            isSelected={textDisplay === 'block'}
            name="list"
            onPress={() => setSettingsTextDisplay('block')}
          />
        </HalfContainer>
        <HalfContainer border>
          <TouchableIcon
            isSelected={theme === 'default'}
            name="sun"
            onPress={() => setSettingsTheme('default')}
          />
          <Text bold>{themeToString[theme]}</Text>
          <TouchableIcon
            isSelected={theme === 'dark'}
            name="moon"
            onPress={() => setSettingsTheme('dark')}
          />
        </HalfContainer>
        <HalfContainer border>
          <TouchableIcon
            isSelected={notesDisplay === 'inline'}
            name="align-left"
            onPress={() => setSettingsNotesDisplay('inline')}
          />
          <Box width={80} center>
            <Text bold style={{ fontSize: 13, textAlign: 'center' }}>
              {notesDisplayToString[notesDisplay]}
            </Text>
          </Box>
          <TouchableIcon
            isSelected={notesDisplay === 'block'}
            name="file-text"
            onPress={() => setSettingsNotesDisplay('block')}
          />
        </HalfContainer>
        <HalfContainer border>
          <TouchableIcon
            isSelected={!commentsDisplay}
            name="x-square"
            onPress={() => setSettingsCommentaires(false)}
          />
          <Box width={80} center>
            <Text bold style={{ fontSize: 13, textAlign: 'center' }}>
              {commentsDisplayToString[commentsDisplay]}
            </Text>
          </Box>
          <TouchableIcon isSelected={commentsDisplay} name="archive" onPress={onOpenCommentaire} />
        </HalfContainer>
        <HalfContainer border>
          <TouchableSvgIcon
            icon={IconShortPress}
            isSelected={press === 'shortPress'}
            onPress={() => setSettingsPress('shortPress')}
            size={25}
          />
          <Box width={80} center>
            <Text bold style={{ fontSize: 13, textAlign: 'center' }}>
              {pressToString[press]}
            </Text>
          </Box>
          <TouchableSvgIcon
            icon={IconLongPress}
            isSelected={press === 'longPress'}
            onPress={() => setSettingsPress('longPress')}
            size={25}
          />
        </HalfContainer>
        <HalfContainer>
          <Link route="ModifyColors" style={{ flexDirection: 'row' }}>
            <SvgIcon icon={ColorWheelIcon} />
            <Box width={135}>
              <Text bold style={{ fontSize: 13 }}>
                Surbrillances
              </Text>
            </Box>
          </Link>
        </HalfContainer>
      </Container>
    </StylizedModal>
  )
}

export default BibleParamsModal
