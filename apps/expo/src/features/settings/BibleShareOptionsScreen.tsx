import { pageContentStyle } from '~common/ui/PageContent'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import React from 'react'
import { Platform, ScrollView } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Header from '~common/Header'
import Box, { TouchableBox } from '~common/ui/Box'
import { useTheme } from '~themes/ThemeProvider'
import { useReadingTypography } from '~common/useReadingTypography'
import { webFontFamily } from '~helpers/webFontFamily'
import Container from '~common/ui/Container'
import Switch from '~common/ui/Switch'
import Text from '~common/ui/Text'
import getVersesContent from '~helpers/getVersesContent'
import { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import {
  toggleSettingsShareAppName,
  toggleSettingsShareLineBreaks,
  toggleSettingsShareQuotes,
  toggleSettingsShareVerseNumbers,
} from '~redux/modules/user'
import { localQueryOptions } from '~helpers/queryOptions'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { loadBibleVerseTexts } from '~features/resources/resourceQueries'
export const useShareOptions = () => {
  const hasVerseNumbers = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasVerseNumbers
  )
  const hasInlineVerses = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasInlineVerses
  )
  const hasQuotes = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasQuotes
  )
  const hasAppName = useSelector(
    (state: RootState) => state.user.bible.settings.shareVerses.hasAppName
  )

  return {
    hasVerseNumbers,
    hasInlineVerses,
    hasQuotes,
    hasAppName,
  }
}

const BibleShareOptionsScreen = ({ inline = false }: { inline?: boolean }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const resources = useResourceAccess()
  const theme = useTheme()
  const typography = useReadingTypography()
  const isWeb = Platform.OS === 'web'
  const { hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName } = useShareOptions()
  const { data: message = '' } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ['bible-share-preview', hasVerseNumbers, hasInlineVerses, hasQuotes, hasAppName],
    queryFn: async () => {
      const { all } = await getVersesContent({
        verses: {
          '1-1-1': true,
          '1-1-2': true,
        },
        version: 'LSG',
        hasVerseNumbers,
        hasInlineVerses,
        hasQuotes,
        hasAppName,
        loadVerseTexts: (versionId, verseKeys) =>
          loadBibleVerseTexts(resources, versionId, verseKeys),
      })
      return all
    },
    ...localQueryOptions,
  })

  const Wrapper = inline ? Box : Container
  return (
    <Wrapper>
      {!inline && <Header hasBackButton title={t('bible.settings.shareOptions')} />}
      <ScrollView contentContainerStyle={pageContentStyle}>
        <Box className={isWeb ? 'p-[4px]' : 'px-[16px] py-[8px]'}>
          {[
            {
              label: t('bible.settings.hasVerseNumbers'),
              value: hasVerseNumbers,
              action: toggleSettingsShareVerseNumbers,
            },
            {
              label: t('bible.settings.hasInlineVerses'),
              value: hasInlineVerses,
              action: toggleSettingsShareLineBreaks,
            },
            {
              label: t('bible.settings.hasQuotes'),
              value: hasQuotes,
              action: toggleSettingsShareQuotes,
            },
            {
              label: t('bible.settings.hasAppName'),
              value: hasAppName,
              action: toggleSettingsShareAppName,
            },
          ].map(option =>
            isWeb ? (
              <TouchableBox
                key={option.label}
                accessibilityRole="switch"
                aria-checked={option.value}
                accessibilityLabel={option.label}
                accessibilityState={{ checked: option.value }}
                onPress={() => dispatch(option.action())}
                className="min-h-[44px] p-[12px] flex-row items-center gap-[12px] rounded-lg hover:bg-[#80808015]"
              >
                <Text className="flex-1 text-[14px]">{option.label}</Text>
                <Box
                  className="w-[36px] h-[22px] rounded-full p-[3px]"
                  style={{
                    backgroundColor: option.value ? theme.colors.primary : theme.colors.border,
                  }}
                >
                  <Box
                    className="w-[16px] h-[16px] rounded-full bg-white"
                    style={{ alignSelf: option.value ? 'flex-end' : 'flex-start' }}
                  />
                </Box>
              </TouchableBox>
            ) : (
              <Box
                key={option.label}
                className="min-h-[56px] py-[8px] flex-row items-center gap-[12px]"
              >
                <Text className="flex-1 text-[16px]">{option.label}</Text>
                <Switch
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: option.value }}
                  value={option.value}
                  onValueChange={() => {
                    dispatch(option.action())
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  ios_backgroundColor={theme.colors.border}
                  thumbColor="#ffffff"
                />
              </Box>
            )
          )}
        </Box>
        <Box
          className={
            isWeb
              ? 'm-[8px] mt-[16px] p-[16px] rounded-[14px] bg-light-grey gap-[12px]'
              : 'm-[16px] p-[20px] rounded-[16px] bg-light-grey gap-[12px]'
          }
        >
          <Text className="text-[11px] uppercase tracking-[1px] text-tertiary">{t('Aperçu')}</Text>
          <Text
            selectable
            style={{
              fontFamily: isWeb ? webFontFamily(typography.fontFamily) : typography.fontFamily,
              fontSize: 16,
              lineHeight: 24,
            }}
          >
            {message || t('Chargement...')}
          </Text>
        </Box>
      </ScrollView>
    </Wrapper>
  )
}
export default BibleShareOptionsScreen
