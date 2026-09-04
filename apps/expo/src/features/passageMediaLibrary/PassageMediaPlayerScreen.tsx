import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

import Header from '~common/Header'
import Box, { VStack } from '~common/ui/Box'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import ScrollView from '~common/ui/ScrollView'
import Text from '~common/ui/Text'
import { formatPassageMediaDuration, getPassageMediaLibrary } from '~features/bible/passageMedia'
import { IS_FORM_SHEET } from '~helpers/constants'
import useLanguage from '~helpers/useLanguage'

const YOUTUBE_PLAYER_BASE_URL =
  'https://lonelycpp.github.io/react-native-youtube-iframe/iframe_v2.html'

const PassageMediaPlayerScreen = () => {
  const { t } = useTranslation()
  const { workId } = useLocalSearchParams<{ workId?: string }>()
  const language = useLanguage()
  const { width: windowWidth } = useWindowDimensions()
  const [playerError, setPlayerError] = useState<string>()
  const item = getPassageMediaLibrary({ language }).find(media => media.workId === workId)
  const playerWidth = Math.min(windowWidth - 32, 720)
  const playerHeight = (playerWidth * 9) / 16

  return (
    <FormSheetScreen isFormSheet={IS_FORM_SHEET}>
      <Box flex bg="reverse">
        <Header background title={item?.title ?? t('passageMediaLibrary.playerTitle')} />
        <ScrollView
          backgroundColor="lightGrey"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingTop: 24 }}
        >
          {item ? (
            <VStack width={playerWidth} gap={18}>
              <Box
                width={playerWidth}
                height={playerHeight}
                borderRadius={14}
                borderWidth={1}
                borderColor="border"
                bg="lightGrey"
                lightShadow
              >
                <YoutubePlayer
                  height={playerHeight}
                  width={playerWidth}
                  videoId={item.providerId}
                  play
                  onError={error => setPlayerError(error || 'unknown')}
                  onReady={() => setPlayerError(undefined)}
                  initialPlayerParams={{ rel: false }}
                  webViewProps={{
                    onShouldStartLoadWithRequest: (request: ShouldStartLoadRequest) => {
                      const url = request.mainDocumentURL || request.url
                      return url === 'about:blank' || url.startsWith(YOUTUBE_PLAYER_BASE_URL)
                    },
                  }}
                  viewContainerStyle={{ borderRadius: 14, overflow: 'hidden' }}
                  webViewStyle={{ borderRadius: 14, overflow: 'hidden' }}
                />
              </Box>
              <VStack gap={7} px={2}>
                <Text title fontSize={22} lineHeight={28}>
                  {item.title}
                </Text>
                <Text text color="grey" fontSize={14}>
                  {formatPassageMediaDuration(item.durationSeconds)} · {item.attributionLabel}
                </Text>
                {!!playerError && (
                  <Text text color="quart" fontSize={14}>
                    {t('passageMediaLibrary.playbackError')}
                  </Text>
                )}
              </VStack>
            </VStack>
          ) : (
            <Box py={60} px={20} center>
              <Text color="grey" textAlign="center">
                {t('passageMediaLibrary.notFound')}
              </Text>
            </Box>
          )}
        </ScrollView>
      </Box>
    </FormSheetScreen>
  )
}

export default PassageMediaPlayerScreen
