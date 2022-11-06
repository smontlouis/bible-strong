import React from 'react'
import { FlatList } from 'react-native'
import { Modalize } from 'react-native-modalize'

import { useTranslation } from 'react-i18next'
import IconLongPress from '~assets/images/IconLongPress'
import IconShortPress from '~assets/images/IconShortPress'
import Link, { LinkBox } from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import Text from '~common/ui/Text'
import { Circle } from '~features/home/SwitchTheme'
import fonts from '~helpers/fonts'
import { usePrevious } from '~helpers/usePrevious'
import { RootState } from '~redux/modules/reducer'
import styled from '~styled/index'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import Paragraph from '~common/ui/Paragraph'
import { useDispatch, useSelector } from 'react-redux'
import {
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  setFontFamily,
  setSettingsAlignContent,
  setSettingsNotesDisplay,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
  setSettingsPress,
  setSettingsTextDisplay,
} from '~redux/modules/user'

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

export const HalfContainer = styled.View<{ border?: boolean }>(
  ({ border, theme }) => ({
    paddingHorizontal: 20,
    paddingRight: 10,
    paddingVertical: 15,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: border ? 1 : 0,
    flexDirection: 'row',
    alignItems: 'center',
  })
)

export const FontText = styled(Paragraph)<{ isSelected: boolean }>(
  ({ isSelected, theme }) => ({
    fontSize: 16,
    paddingLeft: 15,
    paddingRight: 15,
    color: isSelected ? theme.colors.primary : theme.colors.default,
  })
)

export const useParamsModalLabels = () => {
  const { t } = useTranslation()

  const alignContentToString = {
    left: t('À gauche'),
    justify: t('Justifié'),
  }

  const textDisplayToString = {
    inline: t('Continu'),
    block: t('À la ligne'),
  }

  const preferredColorSchemeToString = {
    light: t('Jour'),
    dark: t('Nuit'),
    auto: t('Auto'),
  }

  const preferredLightThemeToString = {
    default: t('Blanc'),
    sepia: t('Sépia'),
  }

  const preferredDarkThemeToString = {
    dark: t('Sombre'),
    black: t('Noir'),
  }

  const pressToString = {
    shortPress: t('Appui court'),
    longPress: t('Appui long'),
  }

  const notesDisplayToString = {
    inline: t('À la ligne'),
    block: t('En icone'),
  }

  return {
    alignContentToString,
    textDisplayToString,
    preferredColorSchemeToString,
    preferredLightThemeToString,
    preferredDarkThemeToString,
    pressToString,
    notesDisplayToString,
  }
}

interface BibleParamsModalprops {
  isOpen: boolean
  onClosed: () => void
  navigation: any
}

const BibleParamsModal = ({
  isOpen,
  onClosed,
  navigation,
}: BibleParamsModalprops) => {
  const isPrevOpen = usePrevious(isOpen)
  const modalRef = React.useRef<Modalize>(null)
  const { t } = useTranslation()

  const {
    alignContentToString,
    textDisplayToString,
    preferredColorSchemeToString,
    preferredLightThemeToString,
    preferredDarkThemeToString,
    pressToString,
    notesDisplayToString,
  } = useParamsModalLabels()

  const dispatch = useDispatch()
  const {
    fontFamily,
    settings: {
      fontSizeScale,
      preferredColorScheme,
      preferredDarkTheme,
      preferredLightTheme,
      alignContent,
      textDisplay,
      notesDisplay,
      press,
    },
  } = useSelector(({ user }: RootState) => ({
    fontFamily: user.fontFamily,
    settings: user.bible.settings,
  }))

  React.useEffect(() => {
    if (isPrevOpen !== isOpen) {
      if (isOpen) {
        modalRef?.current?.open()
      } else {
        modalRef?.current?.close()
      }
    }
  }, [isPrevOpen, isOpen])

  const fontsViewRef = React.useRef(null)

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
            {preferredColorSchemeToString[preferredColorScheme]}
          </Text>
          <TouchableIcon
            isSelected={preferredColorScheme === 'light'}
            name="sun"
            onPress={() => dispatch(setSettingsPreferredColorScheme('light'))}
          />
          <TouchableIcon
            isSelected={preferredColorScheme === 'dark'}
            name="moon"
            onPress={() => dispatch(setSettingsPreferredColorScheme('dark'))}
          />
          <TouchableIcon
            isSelected={preferredColorScheme === 'auto'}
            name="sunrise"
            onPress={() => dispatch(setSettingsPreferredColorScheme('auto'))}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>{t('Couleur Jour')}</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {preferredLightThemeToString[preferredLightTheme]}
          </Text>
          <LinkBox
            onPress={() => dispatch(setSettingsPreferredLightTheme('default'))}
          >
            <Circle
              isSelected={preferredLightTheme === 'default'}
              size={20}
              color="rgb(255,255,255)"
            />
          </LinkBox>
          <LinkBox
            onPress={() => dispatch(setSettingsPreferredLightTheme('sepia'))}
          >
            <Circle
              isSelected={preferredLightTheme === 'sepia'}
              size={20}
              color="rgb(245,242,227)"
            />
          </LinkBox>
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>{t('Couleur Nuit')}</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {preferredDarkThemeToString[preferredDarkTheme]}
          </Text>
          <LinkBox
            onPress={() => dispatch(setSettingsPreferredDarkTheme('dark'))}
          >
            <Circle
              isSelected={preferredDarkTheme === 'dark'}
              size={20}
              color="rgb(18,45,66)"
            />
          </LinkBox>
          <LinkBox
            onPress={() => dispatch(setSettingsPreferredDarkTheme('black'))}
          >
            <Circle
              isSelected={preferredDarkTheme === 'black'}
              size={20}
              color="black"
            />
          </LinkBox>
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>{t('Alignement du texte')}</Text>
          <Text marginLeft={5} fontSize={12} bold marginRight={10}>
            {alignContentToString[alignContent]}
          </Text>
          <TouchableIcon
            isSelected={alignContent === 'justify'}
            name="align-justify"
            onPress={() => dispatch(setSettingsAlignContent('justify'))}
          />
          <TouchableIcon
            isSelected={alignContent === 'left'}
            name="align-left"
            onPress={() => dispatch(setSettingsAlignContent('left'))}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>{t('Taille du texte')}</Text>
          <Text marginLeft={5} fontSize={12} bold>{`${100 +
            fontSizeScale * 10}%`}</Text>
          <TouchableIcon
            name="type"
            size={15}
            onPress={() => dispatch(decreaseSettingsFontSizeScale())}
          />
          <TouchableIcon
            name="type"
            onPress={() => dispatch(increaseSettingsFontSizeScale())}
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
            onPress={() => dispatch(setSettingsTextDisplay('inline'))}
          />
          <TouchableIcon
            isSelected={textDisplay === 'block'}
            name="list"
            onPress={() => dispatch(setSettingsTextDisplay('block'))}
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
            onPress={() => dispatch(setSettingsNotesDisplay('inline'))}
          />
          <TouchableIcon
            isSelected={notesDisplay === 'block'}
            name="file-text"
            onPress={() => dispatch(setSettingsNotesDisplay('block'))}
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
            onPress={() => dispatch(setSettingsPress('shortPress'))}
            size={25}
          />
          <TouchableSvgIcon
            icon={IconLongPress}
            isSelected={press === 'longPress'}
            onPress={() => dispatch(setSettingsPress('longPress'))}
            size={25}
          />
        </HalfContainer>
        <Box height={60}>
          <FlatList
            ref={fontsViewRef}
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
                <Link onPress={() => dispatch(setFontFamily(item))}>
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
