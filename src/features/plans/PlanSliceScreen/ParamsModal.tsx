/**
 * @TODO - Merge this with BibleParamsModal
 */

import React from 'react'
import { FlatList } from 'react-native'
import { Modalize } from 'react-native-modalize'

import { useTheme } from '@emotion/react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Link, { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import Text from '~common/ui/Text'
import {
  FontText,
  HalfContainer,
  useParamsModalLabels,
} from '~features/bible/BibleParamsModal'
import TouchableIcon from '~features/bible/TouchableIcon'
import fonts from '~helpers/fonts'
import { RootState } from '~redux/modules/reducer'
import {
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  setFontFamily,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
} from '~redux/modules/user'
import { Theme } from '~themes'

interface Props {
  paramsModalRef: React.RefObject<Modalize>
}

const ParamsModal = ({ paramsModalRef }: Props) => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const fontsViewRef = React.useRef(null)
  const theme: Theme = useTheme()
  const {
    fontFamily,
    fontSizeScale,
    preferredColorScheme,
    preferredDarkTheme,
    preferredLightTheme,
  } = useSelector(
    ({ user }: RootState) => ({
      fontFamily: user.fontFamily,
      fontSizeScale: user.bible.settings.fontSizeScale,
      preferredColorScheme: user.bible.settings.preferredColorScheme,
      preferredLightTheme: user.bible.settings.preferredLightTheme,
      preferredDarkTheme: user.bible.settings.preferredDarkTheme,
    }),
    shallowEqual
  )

  const {
    preferredColorSchemeToString,
    preferredLightThemeToString,
    preferredDarkThemeToString,
  } = useParamsModalLabels()

  return (
    <Modalize
      modalStyle={{
        backgroundColor: theme.colors.lightGrey,
        maxWidth: 600,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      ref={paramsModalRef}
      adjustToContentHeight
    >
      <Box padding={20} paddingBottom={20 + useSafeAreaInsets().bottom}>
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
        <Box>
          <FlatList
            ref={fontsViewRef}
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
                    scale={-2}
                    isSelected={isSelected}
                    style={{ fontFamily: item }}
                  >
                    {item}
                  </FontText>
                </Link>
              )
            }}
          />
        </Box>
      </Box>
    </Modalize>
  )
}

export default ParamsModal
