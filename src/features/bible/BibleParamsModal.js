import React from 'react'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'
import { FlatList } from 'react-native'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import Button from '~common/ui/Button'
import SnackBar from '~common/SnackBar'
import { getIfDatabaseExists } from '~helpers/database'
import IconShortPress from '~assets/images/IconShortPress'
import IconLongPress from '~assets/images/IconLongPress'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import fonts from '~helpers/fonts'

const StylizedModal = styled(Modal)({
  backgroundColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: getStatusBarHeight() + 10
})

const Container = styled.View(({ theme }) => ({
  width: '100%',
  maxWidth: 400,
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
  paddingHorizontal: 20,
  paddingRight: 10,
  paddingVertical: 15,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'center'
}))

const FontText = styled.Text(({ isSelected, theme }) => ({
  fontSize: 16,
  paddingLeft: 15,
  paddingRight: 15,
  color: isSelected ? theme.colors.primary : theme.colors.default
}))

const alignContentToString = {
  left: 'À gauche',
  justify: 'Justifié'
}

const textDisplayToString = {
  inline: 'Continu',
  block: 'À la ligne'
}

const themeToString = {
  default: 'Jour',
  dark: 'Nuit'
}

const pressToString = {
  shortPress: 'Appui court',
  longPress: 'Appui long'
}

const notesDisplayToString = {
  inline: 'À la ligne',
  block: 'En icone'
}

const commentsDisplayToString = {
  false: 'Sans',
  true: 'Avec'
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
  setFontFamily,
  fontFamily,
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

  const fontsView = React.useRef()

  return (
    <StylizedModal
      isVisible={isOpen}
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
      animationIn="slideInDown"
      animationOut="slideOutUp"
      backdropOpacity={0.2}>
      <Container>
        <HalfContainer border>
          <Text flex={5}>Alignement du texte</Text>
          <Text marginLeft={5} fontSize={12} bold marginRight={10}>
            {alignContentToString[alignContent]}
          </Text>
          <TouchableIcon
            isSelected={alignContent === 'justify'}
            name="align-justify"
            onPress={() => setSettingsAlignContent('justify')}
          />
          <TouchableIcon
            isSelected={alignContent === 'left'}
            name="align-left"
            onPress={() => setSettingsAlignContent('left')}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>Taille du texte</Text>
          <Text marginLeft={5} fontSize={12} bold>{`${100 +
            fontSizeScale * 10}%`}</Text>
          <TouchableIcon
            name="type"
            size={15}
            onPress={() => decreaseSettingsFontSizeScale()}
          />
          <TouchableIcon
            name="type"
            onPress={() => increaseSettingsFontSizeScale()}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>Mode des versets</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {textDisplayToString[textDisplay]}
          </Text>
          <TouchableIcon
            isSelected={textDisplay === 'inline'}
            name="menu"
            onPress={() => setSettingsTextDisplay('inline')}
          />
          <TouchableIcon
            isSelected={textDisplay === 'block'}
            name="list"
            onPress={() => setSettingsTextDisplay('block')}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>Thème</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {themeToString[theme]}
          </Text>
          <TouchableIcon
            isSelected={theme === 'default'}
            name="sun"
            onPress={() => setSettingsTheme('default')}
          />
          <TouchableIcon
            isSelected={theme === 'dark'}
            name="moon"
            onPress={() => setSettingsTheme('dark')}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>Affichage des notes</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {notesDisplayToString[notesDisplay]}
          </Text>

          <TouchableIcon
            isSelected={notesDisplay === 'inline'}
            name="align-left"
            onPress={() => setSettingsNotesDisplay('inline')}
          />
          <TouchableIcon
            isSelected={notesDisplay === 'block'}
            name="file-text"
            onPress={() => setSettingsNotesDisplay('block')}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>Commentaires</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {commentsDisplayToString[commentsDisplay]}
          </Text>
          <TouchableIcon
            isSelected={!commentsDisplay}
            name="x-square"
            onPress={() => setSettingsCommentaires(false)}
          />
          <TouchableIcon
            isSelected={commentsDisplay}
            name="archive"
            onPress={onOpenCommentaire}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>Affichage des strongs</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {pressToString[press]}
          </Text>
          <TouchableSvgIcon
            icon={IconShortPress}
            isSelected={press === 'shortPress'}
            onPress={() => setSettingsPress('shortPress')}
            size={25}
          />
          <TouchableSvgIcon
            icon={IconLongPress}
            isSelected={press === 'longPress'}
            onPress={() => setSettingsPress('longPress')}
            size={25}
          />
        </HalfContainer>
        <Box>
          <FlatList
            ref={fontsView}
            horizontal
            getItemLayout={(data, index) => ({
              length: 100,
              offset: 100 * index,
              index
            })}
            initialScrollIndex={fonts.findIndex(f => f === fontFamily)}
            style={{ paddingVertical: 15 }}
            data={['Literata Book', ...fonts]}
            keyExtractor={item => item}
            renderItem={({ item }) => {
              const isSelected = fontFamily === item
              return (
                <Link onPress={() => setFontFamily(item)}>
                  <FontText
                    isSelected={isSelected}
                    style={{ fontFamily: item }}>
                    {item}
                  </FontText>
                </Link>
              )
            }}
          />
          <Border />
        </Box>
        <HalfContainer>
          <Text flex>Couleurs des surbrillances</Text>
          <Button
            reverse
            title="Ouvrir"
            onPress={() => {
              navigation.navigate('ModifyColors')
              onClosed()
            }}
            small
          />
        </HalfContainer>
      </Container>
    </StylizedModal>
  )
}

export default BibleParamsModal
