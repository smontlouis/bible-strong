import React from 'react'
import { Platform } from 'react-native'
import { SheetHeader, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { LinkBox } from '~common/Link'
import Box, { TouchableBox } from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import Text from '~common/ui/Text'
import { HalfContainer, useParamsModalLabels } from '~features/bible/BibleParamsModal'
import TouchableIcon from '~features/bible/TouchableIcon'
import BibleFontList from '~features/bible/BibleFontList'
import { FeatherIcon } from '~common/ui/Icon'
import { selectBibleSettingsForParams } from '~redux/selectors/user'
import {
  decreaseSettingsFontSizeScale,
  increaseSettingsFontSizeScale,
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
} from '~redux/modules/user'
/**
 * @TODO - Merge this with BibleParamsModal
 */

interface Props {
  paramsModalRef?: React.RefObject<SheetRef | null>
  onFonts?: () => void
  inline?: boolean
}

const ParamsModal = ({ paramsModalRef, inline = false, onFonts }: Props) => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const fontsRef = React.useRef<SheetRef>(null)
  const {
    fontFamily,
    fontSizeScale,
    preferredColorScheme,
    preferredDarkTheme,
    preferredLightTheme,
  } = useSelector(selectBibleSettingsForParams)

  const { preferredColorSchemeToString, preferredLightThemeToString, preferredDarkThemeToString } =
    useParamsModalLabels()

  const isWeb = Platform.OS === 'web'

  const Container = inline ? InlineParams : Sheet
  return (
    <>
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
          <TouchableBox
            testID="bible-params-link"
            accessibilityRole="button"
            accessibilityLabel={t('Polices')}
            className="min-h-[60px] px-[20px] py-[8px] flex-row items-center"
            onPress={() => (onFonts ? onFonts() : fontsRef.current?.present())}
          >
            <Text className="flex-1 text-[14px]">{t('Polices')}</Text>
            <Text className="text-grey text-[14px] mr-[12px]" style={{ fontFamily }}>
              {fontFamily}
            </Text>
            <FeatherIcon name="chevron-right" size={20} color="grey" />
          </TouchableBox>
        </Box>
      </Container>
      {!onFonts && (
        <Sheet ref={fontsRef} header={<SheetHeader title={t('Polices')} />}>
          <BibleFontList onSelect={() => fontsRef.current?.close()} />
        </Sheet>
      )}
    </>
  )
}

export default ParamsModal

const InlineParams = ({
  children,
}: import('~common/ContextualPanel/ContextualSheet').ContextualSheetProps) => <>{children}</>
