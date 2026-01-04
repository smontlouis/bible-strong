import styled from '@emotion/native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Header from '~common/Header'
import { LinkBox } from '~common/Link'
import Box, { HStack, SafeAreaBox } from '~common/ui/Box'
import Circle from '~common/ui/Circle'
import ScrollView from '~common/ui/ScrollView'
import SectionCard, { SectionCardHeader } from '~common/ui/SectionCard'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import TouchableIcon from '~features/bible/TouchableIcon'
import { useParamsModalLabels } from '~features/bible/BibleParamsModal'
import {
  setSettingsPreferredColorScheme,
  setSettingsPreferredLightTheme,
  setSettingsPreferredDarkTheme,
} from '~redux/modules/user'
import { RootState } from '~redux/modules/reducer'

const RowContainer = styled.View<{ border?: boolean }>(({ border, theme }) => ({
  paddingHorizontal: 16,
  paddingVertical: 14,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: border ? 1 : 0,
  flexDirection: 'row',
  alignItems: 'center',
}))

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
    <SafeAreaBox bg="lightGrey">
      <Header hasBackButton title={t('settings.theme')} />
      <ScrollView backgroundColor="lightGrey" contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Section Mode */}
        <SectionCard mt={8}>
          <SectionCardHeader>
            <FeatherIcon name="sun" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('Mode')}
            </Text>
          </SectionCardHeader>
          <RowContainer>
            <Text fontSize={15}>{preferredColorSchemeToString[preferredColorScheme]}</Text>
            <HStack marginLeft="auto" gap={20}>
              <TouchableIcon
                isSelected={preferredColorScheme === 'light'}
                name="sun"
                onPress={() => dispatch(setSettingsPreferredColorScheme('light'))}
                noFlex
              />
              <TouchableIcon
                isSelected={preferredColorScheme === 'dark'}
                name="moon"
                onPress={() => dispatch(setSettingsPreferredColorScheme('dark'))}
                noFlex
              />
              <TouchableIcon
                isSelected={preferredColorScheme === 'auto'}
                name="sunrise"
                onPress={() => dispatch(setSettingsPreferredColorScheme('auto'))}
                noFlex
              />
            </HStack>
          </RowContainer>
        </SectionCard>

        {/* Section Couleur Jour */}
        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="sun" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('Couleur Jour')}
            </Text>
          </SectionCardHeader>
          <RowContainer>
            <Text flex fontSize={15}>
              {preferredLightThemeToString[preferredLightTheme]}
            </Text>
            <LinkBox onPress={() => dispatch(setSettingsPreferredLightTheme('default'))}>
              <Circle
                isSelected={preferredLightTheme === 'default'}
                size={28}
                color="rgb(255,255,255)"
              />
            </LinkBox>
            <LinkBox onPress={() => dispatch(setSettingsPreferredLightTheme('sepia'))}>
              <Circle
                isSelected={preferredLightTheme === 'sepia'}
                size={28}
                color="rgb(245,242,227)"
              />
            </LinkBox>
            <LinkBox onPress={() => dispatch(setSettingsPreferredLightTheme('nature'))}>
              <Circle isSelected={preferredLightTheme === 'nature'} size={28} color="#EAF9EC" />
            </LinkBox>
            <LinkBox onPress={() => dispatch(setSettingsPreferredLightTheme('sunset'))}>
              <Circle isSelected={preferredLightTheme === 'sunset'} size={28} color="#FAE0D5" />
            </LinkBox>
          </RowContainer>
        </SectionCard>

        {/* Section Couleur Nuit */}
        <SectionCard>
          <SectionCardHeader>
            <FeatherIcon name="moon" size={16} color="grey" />
            <Text ml={8} fontSize={12} color="grey" bold style={{ textTransform: 'uppercase' }}>
              {t('Couleur Nuit')}
            </Text>
          </SectionCardHeader>
          <RowContainer>
            <Text flex fontSize={15}>
              {preferredDarkThemeToString[preferredDarkTheme]}
            </Text>
            <LinkBox onPress={() => dispatch(setSettingsPreferredDarkTheme('dark'))}>
              <Circle isSelected={preferredDarkTheme === 'dark'} size={28} color="rgb(18,45,66)" />
            </LinkBox>
            <LinkBox onPress={() => dispatch(setSettingsPreferredDarkTheme('black'))}>
              <Circle isSelected={preferredDarkTheme === 'black'} size={28} color="black" />
            </LinkBox>
            <LinkBox onPress={() => dispatch(setSettingsPreferredDarkTheme('mauve'))}>
              <Circle isSelected={preferredDarkTheme === 'mauve'} size={28} color="rgb(51,4,46)" />
            </LinkBox>
            <LinkBox onPress={() => dispatch(setSettingsPreferredDarkTheme('night'))}>
              <Circle isSelected={preferredDarkTheme === 'night'} size={28} color="rgb(0,50,100)" />
            </LinkBox>
          </RowContainer>
        </SectionCard>
      </ScrollView>
    </SafeAreaBox>
  )
}

export default ThemeScreen
