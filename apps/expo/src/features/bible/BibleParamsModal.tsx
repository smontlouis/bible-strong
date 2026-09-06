import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { FlatList } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { useRouter } from 'expo-router'
import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import IconLongPress from '~assets/images/IconLongPress'
import IconShortPress from '~assets/images/IconShortPress'
import { LineHeightIcon } from '~common/LineHeightIcon'
import Link, { LinkBox } from '~common/Link'
import { Sheet, SheetScrollView, type SheetRef } from '~common/sheet'
import Border from '~common/ui/Border'
import Box, { TouchableBox } from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import fonts from '~helpers/fonts'
import { RootState } from '~redux/modules/reducer'
import {
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  isContextualInformationDisplayEnabled,
  setFontFamily,
  setSettingsAlignContent,
  setSettingsContextualInformationDisplay,
  setSettingsLineHeight,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
  setSettingsPress,
  setSettingsRedWordsDisplay,
  setSettingsRelationsDisplay,
  setSettingsTagsDisplay,
  setSettingsTextDisplay,
} from '~redux/modules/user'
import { colorPickerModalAtom } from '~state/app'
import TouchableIcon from './TouchableIcon'
import TouchableSvgIcon from './TouchableSvgIcon'

export const HalfContainer = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.View>,
    keyof { border?: boolean } | 'theme'
  > &
    Omit<{ border?: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { border } = props
  const classStyles = useResolveClassNames(
    twMerge('px-[20px] pr-[10px] py-[15px] border-b-border flex-row items-center', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={
        [classStyles, { borderBottomWidth: border ? 1 : 0 }, props.style] as UIComponentProps<
          typeof NativeUI.View
        >['style']
      }
    />
  )
}

export const FontText = (
  componentProps: Omit<
    UIComponentProps<typeof Paragraph>,
    keyof { isSelected: boolean } | 'theme'
  > &
    Omit<{ isSelected: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(twMerge('text-[16px] pl-[15px] pr-[15px]', className))
  return (
    <Paragraph
      {...props}
      style={
        [
          classStyles,
          { color: isSelected ? theme.colors.primary : theme.colors.default },
          props.style,
        ] as UIComponentProps<typeof Paragraph>['style']
      }
    />
  )
}

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

  const relationsDisplayToString = {
    inline: t('À la ligne'),
    block: t('En icone'),
  }

  const tagsDisplayToString = {
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
    relationsDisplayToString,
    tagsDisplayToString,
  }
}

interface BibleParamsModalprops {
  modalRef: React.RefObject<SheetRef | null>
}

const BibleParamsModal = ({ modalRef }: BibleParamsModalprops) => {
  const { t } = useTranslation()
  const router = useRouter()
  const setColorPickerModal = useSetAtom(colorPickerModalAtom)

  const {
    alignContentToString,
    lineHeightToString,
    textDisplayToString,
    preferredColorSchemeToString,
    preferredLightThemeToString,
    preferredDarkThemeToString,
    pressToString,
    relationsDisplayToString,
    tagsDisplayToString,
  } = useParamsModalLabels()

  const dispatch = useDispatch()

  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const fontSizeScale = useSelector((state: RootState) => state.user.bible.settings.fontSizeScale)
  const preferredColorScheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredColorScheme
  )
  const preferredDarkTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredDarkTheme
  )
  const preferredLightTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredLightTheme
  )
  const alignContent = useSelector((state: RootState) => state.user.bible.settings.alignContent)
  const lineHeight = useSelector((state: RootState) => state.user.bible.settings.lineHeight)
  const textDisplay = useSelector((state: RootState) => state.user.bible.settings.textDisplay)
  const relationsDisplay = useSelector(
    (state: RootState) =>
      state.user.bible.settings.relationsDisplay ||
      (state.user.bible.settings.notesDisplay === 'block' ||
      state.user.bible.settings.linksDisplay === 'block'
        ? 'block'
        : 'inline')
  )
  const tagsDisplay = useSelector((state: RootState) => state.user.bible.settings.tagsDisplay)
  const press = useSelector((state: RootState) => state.user.bible.settings.press)
  const redWordsDisplay = useSelector(
    (state: RootState) => state.user.bible.settings.redWordsDisplay
  )
  const contextualInformationDisplay = useSelector((state: RootState) =>
    isContextualInformationDisplayEnabled(state.user.bible.settings.contextualInformationDisplay)
  )

  const fontsViewRef = React.useRef(null)

  const initialScrollIndex = fonts.findIndex(f => f === fontFamily)
  const insets = useSafeAreaInsets()
  return (
    <Sheet ref={modalRef} snapPoints={[0.4, 1]}>
      <SheetScrollView
        contentContainerStyle={{
          alignItems: 'stretch',
          justifyContent: 'space-between',
          paddingTop: 10,
          paddingBottom: insets.bottom,
        }}
      >
        <HalfContainer border>
          <Text className="flex-[5]">{t('Thème')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {preferredColorSchemeToString[preferredColorScheme]}
          </Text>
          <TouchableIcon
            accessibilityLabel={preferredColorSchemeToString.light}
            isSelected={preferredColorScheme === 'light'}
            name="sun"
            onPress={() => dispatch(setSettingsPreferredColorScheme('light'))}
          />
          <TouchableIcon
            accessibilityLabel={preferredColorSchemeToString.dark}
            isSelected={preferredColorScheme === 'dark'}
            name="moon"
            onPress={() => dispatch(setSettingsPreferredColorScheme('dark'))}
          />
          <TouchableIcon
            accessibilityLabel={preferredColorSchemeToString.auto}
            isSelected={preferredColorScheme === 'auto'}
            name="sunrise"
            onPress={() => dispatch(setSettingsPreferredColorScheme('auto'))}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Couleur Jour')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {preferredLightThemeToString[preferredLightTheme]}
          </Text>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.default}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'default' }}
            onPress={() => dispatch(setSettingsPreferredLightTheme('default'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle
              isSelected={preferredLightTheme === 'default'}
              size={20}
              color="rgb(255,255,255)"
            />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.sepia}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'sepia' }}
            onPress={() => dispatch(setSettingsPreferredLightTheme('sepia'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle
              isSelected={preferredLightTheme === 'sepia'}
              size={20}
              color="rgb(245,242,227)"
            />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.nature}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'nature' }}
            onPress={() => dispatch(setSettingsPreferredLightTheme('nature'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle isSelected={preferredLightTheme === 'nature'} size={20} color="#EAF9EC" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.sunset}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'sunset' }}
            onPress={() => dispatch(setSettingsPreferredLightTheme('sunset'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle isSelected={preferredLightTheme === 'sunset'} size={20} color="#FAE0D5" />
          </LinkBox>
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Couleur Nuit')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {preferredDarkThemeToString[preferredDarkTheme]}
          </Text>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.dark}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'dark' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('dark'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle isSelected={preferredDarkTheme === 'dark'} size={20} color="rgb(18,45,66)" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.black}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'black' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('black'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle isSelected={preferredDarkTheme === 'black'} size={20} color="black" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.mauve}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'mauve' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('mauve'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle isSelected={preferredDarkTheme === 'mauve'} size={20} color="rgb(51,4,46)" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.night}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'night' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('night'))}
            style={{ width: 40, height: 40 }}
          >
            <Circle isSelected={preferredDarkTheme === 'night'} size={20} color="rgb(0,50,100)" />
          </LinkBox>
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Taille du texte')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">{`${100 + fontSizeScale * 10}%`}</Text>
          <TouchableIcon
            accessibilityLabel={t('accessibility.decreaseTextSize')}
            name="type"
            size={15}
            onPress={() => dispatch(decreaseSettingsFontSizeScale())}
          />
          <TouchableIcon
            accessibilityLabel={t('accessibility.increaseTextSize')}
            name="type"
            onPress={() => dispatch(increaseSettingsFontSizeScale())}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Alignement du texte')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold mr-[10px]">
            {alignContentToString[alignContent]}
          </Text>
          <TouchableIcon
            accessibilityLabel={`${t('Alignement du texte')}: ${alignContentToString[alignContent]}`}
            isSelected
            name={alignContent === 'left' ? 'align-left' : 'align-justify'}
            onPress={() => {
              const nextAlign = alignContent === 'left' ? 'justify' : 'left'
              dispatch(setSettingsAlignContent(nextAlign))
            }}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Hauteur de ligne')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold mr-[10px]">
            {lineHeightToString[lineHeight]}
          </Text>
          <TouchableBox
            className="overflow-hidden border-continuous"
            accessibilityLabel={`${t('Hauteur de ligne')}: ${lineHeightToString[lineHeight]}`}
            accessibilityRole="button"
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
              gap={lineHeight === 'small' ? 1 : lineHeight === 'normal' ? 2 : 4}
            />
          </TouchableBox>
        </HalfContainer>

        <HalfContainer border>
          <Text className="flex-[5]">{t('Mode des versets')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">{textDisplayToString[textDisplay]}</Text>
          <TouchableIcon
            accessibilityLabel={`${t('Mode des versets')}: ${textDisplayToString[textDisplay]}`}
            isSelected
            name={textDisplay === 'inline' ? 'arrow-right' : 'corner-down-right'}
            onPress={() => {
              const nextDisplay = textDisplay === 'inline' ? 'block' : 'inline'
              dispatch(setSettingsTextDisplay(nextDisplay))
            }}
          />
        </HalfContainer>

        <HalfContainer border>
          <Text className="flex-[5]">{t('Affichage des relations')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {relationsDisplayToString[relationsDisplay]}
          </Text>
          <TouchableIcon
            accessibilityLabel={`${t('Affichage des relations')}: ${relationsDisplayToString[relationsDisplay]}`}
            isSelected
            name={relationsDisplay === 'inline' ? 'align-left' : 'git-merge'}
            onPress={() => {
              const nextDisplay = relationsDisplay === 'inline' ? 'block' : 'inline'
              dispatch(setSettingsRelationsDisplay(nextDisplay))
            }}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Affichage des tags')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">{tagsDisplayToString[tagsDisplay]}</Text>
          <TouchableIcon
            accessibilityLabel={`${t('Affichage des tags')}: ${tagsDisplayToString[tagsDisplay]}`}
            isSelected
            name={tagsDisplay === 'inline' ? 'align-left' : 'tag'}
            onPress={() => {
              const nextDisplay = tagsDisplay === 'inline' ? 'block' : 'inline'
              dispatch(setSettingsTagsDisplay(nextDisplay))
            }}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Contexte et médias')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {contextualInformationDisplay ? t('Activé') : t('Désactivé')}
          </Text>
          <TouchableIcon
            accessibilityLabel={t('Contexte et médias')}
            isSelected={contextualInformationDisplay}
            name="film"
            onPress={() =>
              dispatch(setSettingsContextualInformationDisplay(!contextualInformationDisplay))
            }
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Paroles de Jésus en rouge')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {redWordsDisplay ? t('Activé') : t('Désactivé')}
          </Text>
          <TouchableIcon
            accessibilityLabel={t('Paroles de Jésus en rouge')}
            isSelected={redWordsDisplay}
            name="type"
            onPress={() => dispatch(setSettingsRedWordsDisplay(!redWordsDisplay))}
          />
        </HalfContainer>
        <HalfContainer border>
          <Text className="flex-[5]">{t('Affichage des strongs')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">{pressToString[press]}</Text>
          <TouchableSvgIcon
            icon={press === 'shortPress' ? IconShortPress : IconLongPress}
            isSelected
            onPress={() => {
              const nextPress = press === 'shortPress' ? 'longPress' : 'shortPress'
              dispatch(setSettingsPress(nextPress))
            }}
            size={25}
          />
        </HalfContainer>
        <Box className="overflow-hidden border-continuous h-[60px]">
          <FlatList
            ref={fontsViewRef}
            ListHeaderComponent={<Text className="ml-[20px] mr-[50px]">{t('Polices')}</Text>}
            horizontal
            getItemLayout={(data, index) => ({
              length: 100,
              offset: 100 * index,
              index,
            })}
            initialScrollIndex={initialScrollIndex === -1 ? 0 : initialScrollIndex}
            style={{ paddingVertical: 15 }}
            data={['Literata Book', ...fonts]}
            keyExtractor={item => item}
            renderItem={({ item }) => {
              const isSelected = fontFamily === item
              return (
                <Link onPress={() => dispatch(setFontFamily(item))}>
                  <FontText isSelected={isSelected} style={{ fontFamily: item }}>
                    {item}
                  </FontText>
                </Link>
              )
            }}
          />
          <Border />
        </Box>
        <TouchableBox
          className="overflow-hidden border-continuous px-[20px] py-[15px] items-center flex-row"
          onPress={() => {
            modalRef.current?.close()
            setColorPickerModal({})
          }}
        >
          <Text className="flex-[1]">{t('Palette de couleurs')}</Text>
          <FeatherIcon name="chevron-right" size={20} color="grey" />
        </TouchableBox>
        <Border />
        <TouchableBox
          className="overflow-hidden border-continuous px-[20px] py-[15px] items-center flex-row"
          onPress={() => {
            router.push('/bible-share-options')
            modalRef.current?.close()
          }}
        >
          <Text className="flex-[1]">{t('bible.settings.shareOptions')}</Text>
          <FeatherIcon name="chevron-right" size={20} color="grey" />
        </TouchableBox>
      </SheetScrollView>
    </Sheet>
  )
}

export default BibleParamsModal
