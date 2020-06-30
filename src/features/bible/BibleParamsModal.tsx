import React from 'react'
import styled from '@emotion/native'
import { FlatList } from 'react-native'
import { Modalize } from 'react-native-modalize'

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
import { usePrevious } from '~helpers/usePrevious'
import { useTranslation } from 'react-i18next'

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
  justifyContent: 'space-between',
}))

const HalfContainer = styled.View(({ border, theme }) => ({
  paddingHorizontal: 20,
  paddingRight: 10,
  paddingVertical: 15,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'center',
}))

const FontText = styled.Text(({ isSelected, theme }) => ({
  fontSize: 16,
  paddingLeft: 15,
  paddingRight: 15,
  color: isSelected ? theme.colors.primary : theme.colors.default,
}))

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
  },
}) => {
  const isPrevOpen = usePrevious(isOpen)
  const modalRef = React.useRef(null)
  const { t } = useTranslation()

  const alignContentToString = {
    left: t('À gauche'),
    justify: t('Justifié'),
  }

  const textDisplayToString = {
    inline: t('Continu'),
    block: t('À la ligne'),
  }

  const themeToString = {
    default: t('Jour'),
    dark: t('Nuit'),
  }

  const pressToString = {
    shortPress: t('Appui court'),
    longPress: t('Appui long'),
  }

  const notesDisplayToString = {
    inline: t('À la ligne'),
    block: t('En icone'),
  }

  React.useEffect(() => {
    if (isPrevOpen !== isOpen) {
      if (isOpen) {
        modalRef?.current?.open()
      } else {
        modalRef?.current?.close()
      }
    }
  }, [isPrevOpen, isOpen])

  const fontsView = React.useRef()

  return (
    <Modalize
      ref={modalRef}
      onClose={onClosed}
      modalStyle={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 400,
        width: '100%',
      }}
      adjustToContentHeight
    >
      <Container>
        <HalfContainer border>
          <Text flex={5}>{t('Thème')}</Text>
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
          <Text flex={5}>{t('Alignement du texte')}</Text>
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
          <Text flex={5}>{t('Taille du texte')}</Text>
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
          <Text flex={5}>{t('Mode des versets')}</Text>
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
          <Text flex={5}>{t('Affichage des notes')}</Text>
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
          <Text flex={5}>{t('Affichage des strongs')}</Text>
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
        <Box height={60}>
          <FlatList
            ref={fontsView}
            ListHeaderComponent={
              <Text marginLeft={20} marginRight={50}>
                {t('Polices')}
              </Text>
            }
            horizontal
            getItemLayout={(data, index) => ({
              length: 100,
              offset: 100 * index,
              index,
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
                    style={{ fontFamily: item }}
                  >
                    {item}
                  </FontText>
                </Link>
              )
            }}
          />
          <Border />
        </Box>
        <HalfContainer>
          <Text flex>{t('Couleurs des surbrillances')}</Text>
          <Button
            reverse
            onPress={() => {
              navigation.navigate('ModifyColors')
              onClosed()
            }}
            small
          >
            {t('Ouvrir')}
          </Button>
        </HalfContainer>
      </Container>
    </Modalize>
  )
}

export default BibleParamsModal
