import React, { memo } from 'react'
import { FlatList } from 'react-native'

import styled from '@emotion/native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import IconLongPress from '~assets/images/IconLongPress'
import IconShortPress from '~assets/images/IconShortPress'
import Link, { LinkBox } from '~common/Link'
import Border from '~common/ui/Border'
import Box, { TouchableBox } from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import fonts from '~helpers/fonts'
import { RootState } from '~redux/modules/reducer'
import {
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  setFontFamily,
  setSettingsAlignContent,
  setSettingsLineHeight,
  setSettingsNotesDisplay,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
  setSettingsPress,
  setSettingsTextDisplay,
} from '~redux/modules/user'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'
import { LineHeightIcon } from '~common/LineHeightIcon'

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

  const lineHeightToString = {
    normal: t('Normal'),
    small: t('Petit'),
    large: t('Grand'),
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
    nature: t('Nature'),
    sunset: t('Soleil couchant'),
  }

  const preferredDarkThemeToString = {
    dark: t('Sombre'),
    black: t('Noir'),
    mauve: t('Mauve'),
    night: t('Bleu nuit'),
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
    lineHeightToString,
    textDisplayToString,
    preferredColorSchemeToString,
    preferredLightThemeToString,
    preferredDarkThemeToString,
    pressToString,
    notesDisplayToString,
  }
}

interface BibleParamsModalprops {
  modalRef: React.RefObject<BottomSheet>
  navigation: any
}

const BibleParamsModal = ({ modalRef, navigation }: BibleParamsModalprops) => {
  const { t } = useTranslation()

  const {
    alignContentToString,
    lineHeightToString,
    textDisplayToString,
    preferredColorSchemeToString,
    preferredLightThemeToString,
    preferredDarkThemeToString,
    pressToString,
    notesDisplayToString,
  } = useParamsModalLabels()

  const dispatch = useDispatch()

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const fontSizeScale = useSelector(
    (state: RootState) => state.user.bible.settings.fontSizeScale
  )
  const preferredColorScheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredColorScheme
  )
  const preferredDarkTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredDarkTheme
  )
  const preferredLightTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredLightTheme
  )
  const alignContent = useSelector(
    (state: RootState) => state.user.bible.settings.alignContent
  )
  const lineHeight = useSelector(
    (state: RootState) => state.user.bible.settings.lineHeight
  )
  const textDisplay = useSelector(
    (state: RootState) => state.user.bible.settings.textDisplay
  )
  const notesDisplay = useSelector(
    (state: RootState) => state.user.bible.settings.notesDisplay
  )
  const press = useSelector(
    (state: RootState) => state.user.bible.settings.press
  )

  const fontsViewRef = React.useRef(null)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const initialScrollIndex = fonts.findIndex(f => f === fontFamily)
  const insets = useSafeAreaInsets()
  return (
    <Portal>
      <BottomSheet
        ref={modalRef}
        index={-1}
        enablePanDownToClose
        backdropComponent={props => renderBackdrop({ ...props, opacity: 0.1 })}
        enableDynamicSizing={false}
        snapPoints={['40%']}
        key={key}
        {...bottomSheetStyles}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            alignItems: 'stretch',
            justifyContent: 'space-between',
            paddingTop: 10,
            paddingBottom: insets.bottom,
          }}
        >
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
              onPress={() =>
                dispatch(setSettingsPreferredLightTheme('default'))
              }
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
            <LinkBox
              onPress={() => dispatch(setSettingsPreferredLightTheme('nature'))}
            >
              <Circle
                isSelected={preferredLightTheme === 'nature'}
                size={20}
                color="#EAF9EC"
              />
            </LinkBox>
            <LinkBox
              onPress={() => dispatch(setSettingsPreferredLightTheme('sunset'))}
            >
              <Circle
                isSelected={preferredLightTheme === 'sunset'}
                size={20}
                color="#FAE0D5"
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
            <LinkBox
              onPress={() => dispatch(setSettingsPreferredDarkTheme('mauve'))}
            >
              <Circle
                isSelected={preferredDarkTheme === 'mauve'}
                size={20}
                color="rgb(51,4,46)"
              />
            </LinkBox>
            <LinkBox
              onPress={() => dispatch(setSettingsPreferredDarkTheme('night'))}
            >
              <Circle
                isSelected={preferredDarkTheme === 'night'}
                size={20}
                color="rgb(0,50,100)"
              />
            </LinkBox>
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
            <Text flex={5}>{t('Alignement du texte')}</Text>
            <Text marginLeft={5} fontSize={12} bold marginRight={10}>
              {alignContentToString[alignContent]}
            </Text>
            <TouchableIcon
              isSelected
              name={alignContent === 'left' ? 'align-left' : 'align-justify'}
              onPress={() => {
                const nextAlign = alignContent === 'left' ? 'justify' : 'left'
                dispatch(setSettingsAlignContent(nextAlign))
              }}
            />
          </HalfContainer>
          <HalfContainer border>
            <Text flex={5}>{t('Hauteur de ligne')}</Text>
            <Text marginLeft={5} fontSize={12} bold marginRight={10}>
              {lineHeightToString[lineHeight]}
            </Text>
            <TouchableBox
              onPress={() => {
                const nextLineHeight = {
                  small: 'normal',
                  normal: 'large',
                  large: 'small',
                } as const
                dispatch(setSettingsLineHeight(nextLineHeight[lineHeight]))
              }}
            >
              <LineHeightIcon
                isSelected
                gap={
                  lineHeight === 'small' ? 1 : lineHeight === 'normal' ? 2 : 4
                }
              />
            </TouchableBox>
          </HalfContainer>

          <HalfContainer border>
            <Text flex={5}>{t('Mode des versets')}</Text>
            <Text marginLeft={5} fontSize={12} bold>
              {textDisplayToString[textDisplay]}
            </Text>
            <TouchableIcon
              isSelected
              name={
                textDisplay === 'inline' ? 'arrow-right' : 'corner-down-right'
              }
              onPress={() => {
                const nextDisplay =
                  textDisplay === 'inline' ? 'block' : 'inline'
                dispatch(setSettingsTextDisplay(nextDisplay))
              }}
            />
          </HalfContainer>

          <HalfContainer border>
            <Text flex={5}>{t('Affichage des notes')}</Text>
            <Text marginLeft={5} fontSize={12} bold>
              {notesDisplayToString[notesDisplay]}
            </Text>
            <TouchableIcon
              isSelected
              name={notesDisplay === 'inline' ? 'align-left' : 'file-text'}
              onPress={() => {
                const nextDisplay =
                  notesDisplay === 'inline' ? 'block' : 'inline'
                dispatch(setSettingsNotesDisplay(nextDisplay))
              }}
            />
          </HalfContainer>
          <HalfContainer border>
            <Text flex={5}>{t('Affichage des strongs')}</Text>
            <Text marginLeft={5} fontSize={12} bold>
              {pressToString[press]}
            </Text>
            <TouchableSvgIcon
              icon={press === 'shortPress' ? IconShortPress : IconLongPress}
              isSelected
              onPress={() => {
                const nextPress =
                  press === 'shortPress' ? 'longPress' : 'shortPress'
                dispatch(setSettingsPress(nextPress))
              }}
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
              initialScrollIndex={
                initialScrollIndex === -1 ? 0 : initialScrollIndex
              }
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
          <TouchableBox
            px={20}
            py={15}
            alignItems="center"
            row
            onPress={() => {
              navigation.navigate('ModifyColors')
              modalRef.current?.close()
            }}
          >
            <Text flex>{t('Couleurs des surbrillances')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </TouchableBox>
          <Border />
          <TouchableBox
            px={20}
            py={15}
            alignItems="center"
            row
            onPress={() => {
              navigation.navigate('BibleShareOptions')
              modalRef.current?.close()
            }}
          >
            <Text flex>{t('bible.settings.shareOptions')}</Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </TouchableBox>
        </BottomSheetScrollView>
      </BottomSheet>
    </Portal>
  )
}

export default memo(BibleParamsModal)
