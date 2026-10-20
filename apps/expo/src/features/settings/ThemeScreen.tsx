import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Box, { HStack, SafeAreaBox } from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import ListSection from '~common/ui/ListSection'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { useParamsModalLabels } from '~features/bible/BibleParamsModal'
import TouchableIcon from '~features/bible/TouchableIcon'
import { RootState } from '~redux/modules/reducer'
import {
  setSettingsPreferredColorScheme,
  setSettingsPreferredDarkTheme,
  setSettingsPreferredLightTheme,
} from '~redux/modules/user'

/** The one row of a section: the current choice, then the controls that change it. */
const ChoiceRow = ({ children }: { children: ReactNode }) => (
  <Box className="min-h-[56px] px-[14px] py-[8px] flex-row items-center">{children}</Box>
)

const ThemeScreen = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const preferredColorScheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredColorScheme
  )
  const preferredLightTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredLightTheme
  )
  const preferredDarkTheme = useSelector(
    (state: RootState) => state.user.bible.settings.preferredDarkTheme
  )

  const { preferredColorSchemeToString, preferredLightThemeToString, preferredDarkThemeToString } =
    useParamsModalLabels()

  return (
    <SafeAreaBox className="overflow-hidden border-continuous bg-canvas">
      <Header hasBackButton title={t('settings.theme')} />
      <ScrollView backgroundColor="canvas" contentContainerStyle={{ paddingBottom: 20 }}>
        <ListSection title={t('Mode')}>
          <ChoiceRow>
            <Text className="text-[15px]">
              {preferredColorSchemeToString[preferredColorScheme]}
            </Text>
            <HStack className="overflow-hidden border-continuous ml-auto gap-[20px]">
              <TouchableIcon
                accessibilityLabel={preferredColorSchemeToString.light}
                isSelected={preferredColorScheme === 'light'}
                name="sun"
                onPress={() => dispatch(setSettingsPreferredColorScheme('light'))}
                noFlex
              />
              <TouchableIcon
                accessibilityLabel={preferredColorSchemeToString.dark}
                isSelected={preferredColorScheme === 'dark'}
                name="moon"
                onPress={() => dispatch(setSettingsPreferredColorScheme('dark'))}
                noFlex
              />
              <TouchableIcon
                accessibilityLabel={preferredColorSchemeToString.auto}
                isSelected={preferredColorScheme === 'auto'}
                name="sunrise"
                onPress={() => dispatch(setSettingsPreferredColorScheme('auto'))}
                noFlex
              />
            </HStack>
          </ChoiceRow>
        </ListSection>

        <ListSection title={t('Couleur Jour')}>
          <ChoiceRow>
            <Text className="flex-[1] text-[15px]">
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
                size={28}
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
                size={28}
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
              <Circle isSelected={preferredLightTheme === 'nature'} size={28} color="#EAF9EC" />
            </LinkBox>
            <LinkBox
              accessibilityLabel={preferredLightThemeToString.sunset}
              accessibilityRole="radio"
              accessibilityState={{ checked: preferredLightTheme === 'sunset' }}
              onPress={() => dispatch(setSettingsPreferredLightTheme('sunset'))}
              style={{ width: 40, height: 40 }}
            >
              <Circle isSelected={preferredLightTheme === 'sunset'} size={28} color="#FAE0D5" />
            </LinkBox>
          </ChoiceRow>
        </ListSection>

        <ListSection title={t('Couleur Nuit')}>
          <ChoiceRow>
            <Text className="flex-[1] text-[15px]">
              {preferredDarkThemeToString[preferredDarkTheme]}
            </Text>
            <LinkBox
              accessibilityLabel={preferredDarkThemeToString.dark}
              accessibilityRole="radio"
              accessibilityState={{ checked: preferredDarkTheme === 'dark' }}
              onPress={() => dispatch(setSettingsPreferredDarkTheme('dark'))}
              style={{ width: 40, height: 40 }}
            >
              <Circle isSelected={preferredDarkTheme === 'dark'} size={28} color="rgb(18,45,66)" />
            </LinkBox>
            <LinkBox
              accessibilityLabel={preferredDarkThemeToString.black}
              accessibilityRole="radio"
              accessibilityState={{ checked: preferredDarkTheme === 'black' }}
              onPress={() => dispatch(setSettingsPreferredDarkTheme('black'))}
              style={{ width: 40, height: 40 }}
            >
              <Circle isSelected={preferredDarkTheme === 'black'} size={28} color="black" />
            </LinkBox>
            <LinkBox
              accessibilityLabel={preferredDarkThemeToString.mauve}
              accessibilityRole="radio"
              accessibilityState={{ checked: preferredDarkTheme === 'mauve' }}
              onPress={() => dispatch(setSettingsPreferredDarkTheme('mauve'))}
              style={{ width: 40, height: 40 }}
            >
              <Circle isSelected={preferredDarkTheme === 'mauve'} size={28} color="rgb(51,4,46)" />
            </LinkBox>
            <LinkBox
              accessibilityLabel={preferredDarkThemeToString.night}
              accessibilityRole="radio"
              accessibilityState={{ checked: preferredDarkTheme === 'night' }}
              onPress={() => dispatch(setSettingsPreferredDarkTheme('night'))}
              style={{ width: 40, height: 40 }}
            >
              <Circle isSelected={preferredDarkTheme === 'night'} size={28} color="rgb(0,50,100)" />
            </LinkBox>
          </ChoiceRow>
        </ListSection>
      </ScrollView>
    </SafeAreaBox>
  )
}

export default ThemeScreen
