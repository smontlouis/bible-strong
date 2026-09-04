/**
 * @TODO - Merge this with BibleParamsModal
 */

import React from 'react'
import { FlatList } from 'react-native'

import { Sheet, type SheetRef } from '~common/sheet'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Link, { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import Text from '~common/ui/Text'
import { FontText, HalfContainer, useParamsModalLabels } from '~features/bible/BibleParamsModal'
import TouchableIcon from '~features/bible/TouchableIcon'
import fonts from '~helpers/fonts'
import { selectBibleSettingsForParams } from '~redux/selectors/user'
import {
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  setFontFamily,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
} from '~redux/modules/user'

// Extracted constant to avoid recreation on each render
const FONTS_DATA = ['Literata Book', ...fonts]

interface Props {
  paramsModalRef: React.RefObject<SheetRef | null>
}

const ParamsModal = ({ paramsModalRef }: Props) => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const fontsViewRef = React.useRef(null)
  const {
    fontFamily,
    fontSizeScale,
    preferredColorScheme,
    preferredDarkTheme,
    preferredLightTheme,
  } = useSelector(selectBibleSettingsForParams)

  const { preferredColorSchemeToString, preferredLightThemeToString, preferredDarkThemeToString } =
    useParamsModalLabels()

  const initialScrollIndex = fonts.findIndex(f => f === fontFamily)

  return (
    <Sheet ref={paramsModalRef} backdrop={false}>
      <Box padding={20}>
        <HalfContainer border>
          <Text flex={5}>{t('Taille du texte')}</Text>
          <Text marginLeft={5} fontSize={12} bold>{`${100 + fontSizeScale * 10}%`}</Text>
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
          <Text flex={5}>{t('Thème')}</Text>
          <Text marginLeft={5} fontSize={12} bold>
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
          <Text flex={5}>{t('Couleur Jour')}</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {preferredLightThemeToString[preferredLightTheme]}
          </Text>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.default}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'default' }}
            size={40}
            onPress={() => dispatch(setSettingsPreferredLightTheme('default'))}
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
            size={40}
            onPress={() => dispatch(setSettingsPreferredLightTheme('sepia'))}
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
            size={40}
            onPress={() => dispatch(setSettingsPreferredLightTheme('nature'))}
          >
            <Circle isSelected={preferredLightTheme === 'nature'} size={20} color="#EAF9EC" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.sunset}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'sunset' }}
            size={40}
            onPress={() => dispatch(setSettingsPreferredLightTheme('sunset'))}
          >
            <Circle isSelected={preferredLightTheme === 'sunset'} size={20} color="#FAE0D5" />
          </LinkBox>
        </HalfContainer>
        <HalfContainer border>
          <Text flex={5}>{t('Couleur Nuit')}</Text>
          <Text marginLeft={5} fontSize={12} bold>
            {preferredDarkThemeToString[preferredDarkTheme]}
          </Text>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.dark}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'dark' }}
            size={40}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('dark'))}
          >
            <Circle isSelected={preferredDarkTheme === 'dark'} size={20} color="rgb(18,45,66)" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.black}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'black' }}
            size={40}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('black'))}
          >
            <Circle isSelected={preferredDarkTheme === 'black'} size={20} color="black" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.mauve}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'mauve' }}
            size={40}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('mauve'))}
          >
            <Circle isSelected={preferredDarkTheme === 'mauve'} size={20} color="rgb(51,4,46)" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.night}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'night' }}
            size={40}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('night'))}
          >
            <Circle isSelected={preferredDarkTheme === 'night'} size={20} color="rgb(0,50,100)" />
          </LinkBox>
        </HalfContainer>
        <Box>
          <FlatList
            ref={fontsViewRef}
            horizontal
            getItemLayout={(data, index) => ({
              length: 100,
              offset: 100 * index,
              index,
            })}
            initialScrollIndex={initialScrollIndex === -1 ? 0 : initialScrollIndex}
            style={{ paddingVertical: 15 }}
            data={FONTS_DATA}
            keyExtractor={item => item}
            renderItem={({ item }) => {
              const isSelected = fontFamily === item
              return (
                <Link onPress={() => dispatch(setFontFamily(item))}>
                  <FontText scale={-2} isSelected={isSelected} style={{ fontFamily: item }}>
                    {item}
                  </FontText>
                </Link>
              )
            }}
          />
        </Box>
      </Box>
    </Sheet>
  )
}

export default ParamsModal
