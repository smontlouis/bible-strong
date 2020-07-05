import React from 'react'
import { Modalize } from 'react-native-modalize'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { FlatList } from 'react-native'

import fonts from '~helpers/fonts'
import Link from '~common/Link'
import styled from '~styled'
import Paragraph from '~common/ui/Paragraph'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  increaseSettingsFontSizeScale,
  decreaseSettingsFontSizeScale,
  setSettingsTheme,
  setFontFamily,
} from '~redux/modules/user'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import TouchableIcon from '~features/bible/TouchableIcon'
import { useTheme } from 'emotion-theming'
import { Theme } from '~themes'
import { useTranslation } from 'react-i18next'

interface Props {
  paramsModalRef: React.RefObject<Modalize>
}

const HalfContainer = styled.View(({ border, theme }) => ({
  paddingHorizontal: 20,
  paddingRight: 10,
  paddingVertical: 15,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'center',
}))

const FontText = styled(Paragraph)(
  ({ isSelected, theme }: { isSelected: boolean } & typeof Text) => ({
    paddingLeft: 15,
    paddingRight: 15,
    color: isSelected ? theme.colors.primary : theme.colors.default,
  })
)

const themeToString: { [x: string]: string } = {
  default: 'Jour',
  dark: 'Nuit',
}

const ParamsModal = ({ paramsModalRef }: Props) => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const fontsView = React.useRef()
  const theme: Theme = useTheme()
  const {
    fontFamily,
    fontSizeScale,
    themeType,
  }: {
    fontFamily: string
    fontSizeScale: number
    themeType: string
  } = useSelector(({ user }: RootState) => ({
    fontFamily: user.fontFamily,
    fontSizeScale: user.bible.settings.fontSizeScale,
    themeType: user.bible.settings.theme,
  }))
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
      <Box padding={20} paddingBottom={20 + getBottomSpace()}>
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
            {t(themeToString[themeType])}
          </Text>
          <TouchableIcon
            isSelected={themeType === 'default'}
            name="sun"
            onPress={() => dispatch(setSettingsTheme('default'))}
          />
          <TouchableIcon
            isSelected={themeType === 'dark'}
            name="moon"
            onPress={() => dispatch(setSettingsTheme('dark'))}
          />
        </HalfContainer>
        <Box>
          <FlatList
            ref={fontsView}
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
