import React from 'react'
import { FlatList, Platform } from 'react-native'
import { type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
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
/**
 * @TODO - Merge this with BibleParamsModal
 */

// Extracted constant to avoid recreation on each render
const FONTS_DATA = ['Literata Book', ...fonts]

interface Props {
  paramsModalRef?: React.RefObject<SheetRef | null>
  inline?: boolean
}

const ParamsModal = ({ paramsModalRef, inline = false }: Props) => {
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
  const isWeb = Platform.OS === 'web'

  const Container = inline ? InlineParams : Sheet
  return (
    <Container ref={paramsModalRef} backdrop={false} panelTitle={t('Mise en forme')}>
      <Box
        testID={isWeb ? 'bible-params-inline' : undefined}
        className={isWeb ? '' : 'overflow-hidden border-continuous p-[20px]'}
      >
        <HalfContainer border>
          <Text className={isWeb ? 'flex-[5] text-[14px]' : 'flex-[5]'}>
            {t('Taille du texte')}
          </Text>
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
          <Text className={isWeb ? 'flex-[5] text-[14px]' : 'flex-[5]'}>{t('Thème')}</Text>
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
          <Text className={isWeb ? 'flex-[5] text-[14px]' : 'flex-[5]'}>{t('Couleur Jour')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {preferredLightThemeToString[preferredLightTheme]}
          </Text>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.default}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'default' }}
            onPress={() => dispatch(setSettingsPreferredLightTheme('default'))}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
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
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
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
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Circle isSelected={preferredLightTheme === 'nature'} size={20} color="#EAF9EC" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredLightThemeToString.sunset}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredLightTheme === 'sunset' }}
            onPress={() => dispatch(setSettingsPreferredLightTheme('sunset'))}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Circle isSelected={preferredLightTheme === 'sunset'} size={20} color="#FAE0D5" />
          </LinkBox>
        </HalfContainer>
        <HalfContainer border>
          <Text className={isWeb ? 'flex-[5] text-[14px]' : 'flex-[5]'}>{t('Couleur Nuit')}</Text>
          <Text className="ml-[5px] text-[12px] font-bold">
            {preferredDarkThemeToString[preferredDarkTheme]}
          </Text>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.dark}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'dark' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('dark'))}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Circle isSelected={preferredDarkTheme === 'dark'} size={20} color="rgb(18,45,66)" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.black}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'black' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('black'))}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Circle isSelected={preferredDarkTheme === 'black'} size={20} color="black" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.mauve}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'mauve' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('mauve'))}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Circle isSelected={preferredDarkTheme === 'mauve'} size={20} color="rgb(51,4,46)" />
          </LinkBox>
          <LinkBox
            accessibilityLabel={preferredDarkThemeToString.night}
            accessibilityRole="radio"
            accessibilityState={{ checked: preferredDarkTheme === 'night' }}
            onPress={() => dispatch(setSettingsPreferredDarkTheme('night'))}
            style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
          >
            <Circle isSelected={preferredDarkTheme === 'night'} size={20} color="rgb(0,50,100)" />
          </LinkBox>
        </HalfContainer>
        <Box className="overflow-hidden border-continuous">
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
    </Container>
  )
}

export default ParamsModal

const InlineParams = ({
  children,
}: import('~common/ContextualPanel/ContextualSheet').ContextualSheetProps) => <>{children}</>
