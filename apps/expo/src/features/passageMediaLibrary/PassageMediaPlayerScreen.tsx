import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import Header from '~common/Header'
import Box, { VStack } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ScrollView from '~common/ui/ScrollView'
import { radii } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, getPassageMediaById } from '~features/bible/passageMedia'
import { IS_FORM_SHEET } from '~helpers/constants'
import useLanguage from '~helpers/useLanguage'

const PassageMediaPlayerScreen = () => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const { workId, language: requestedLanguage } = useLocalSearchParams<{
    workId?: string
    language?: string
  }>()
  const preferredLanguage = useLanguage()
  const language =
    requestedLanguage === 'fr' || requestedLanguage === 'en' ? requestedLanguage : preferredLanguage
  const { width: windowWidth } = useWindowDimensions()
  const [playerError, setPlayerError] = useState<string>()
  const item = workId ? getPassageMediaById(workId, language) : null
  const playerWidth = Math.min(windowWidth - 32, 720)
  const playerHeight = (playerWidth * 9) / 16

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box className="overflow-hidden border-continuous flex-[1] bg-reverse">
        <Header background title={item?.title ?? t('passageMediaLibrary.playerTitle')} />
        <ScrollView
          backgroundColor="lightGrey"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 24 }}
        >
          {item ? (
            <VStack
              className="overflow-hidden border-continuous gap-[18px]"
              style={{ width: playerWidth }}
            >
              <Box
                className="border-continuous overflow-hidden rounded-[16px] bg-light-grey"
                style={{ width: playerWidth, height: playerHeight }}
              >
                <YoutubePlayer
                  height={playerHeight}
                  width={playerWidth}
                  videoId={item.providerId}
                  play
                  onError={error => setPlayerError(error || 'unknown')}
                  onReady={() => setPlayerError(undefined)}
                  initialPlayerParams={{ rel: false }}
                  viewContainerStyle={{ borderRadius: radii.card, overflow: 'hidden' }}
                  webViewStyle={{ borderRadius: radii.card, overflow: 'hidden' }}
                />
              </Box>
              <VStack className="overflow-hidden border-continuous gap-[7px] px-[2px]">
                <Text
                  className="text-[22px] leading-[28px]"
                  style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
                >
                  {item.title}
                </Text>
                <Text
                  className="text-grey text-[14px]"
                  style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
                >
                  {formatPassageMediaDuration(item.durationSeconds)} · {item.attributionLabel}
                </Text>
                {!!playerError && (
                  <Text
                    className="text-quart text-[14px]"
                    style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.text) }}
                  >
                    {t('passageMediaLibrary.playbackError')}
                  </Text>
                )}
              </VStack>
            </VStack>
          ) : (
            <Box className="overflow-hidden border-continuous py-[60px] px-[20px] items-center justify-center">
              <Text className="text-grey text-center">{t('passageMediaLibrary.notFound')}</Text>
            </Box>
          )}
        </ScrollView>
      </Box>
    </FormSheetScreen>
  )
}

export default PassageMediaPlayerScreen
