import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import React, { useState } from 'react'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import Box from '~common/ui/Box'

import { Plan, VideoSlice as VideoSliceProps } from 'src/common/types'
import ReferenceParagraph from './ReferenceParagraph'
import PublisherVideo from './PublisherVideo'

type Props = VideoSliceProps & {
  planLanguage?: Plan['lang']
}

const VideoSlice = ({ title, description, url, webUrl, poster, planLanguage }: Props) => {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [iframeWidth, setIframeWidth] = useState(0)
  const iframeHeight = (iframeWidth * 9) / 16
  const videoId = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  )?.[1]
  return (
    <Box
      onLayout={event => setIframeWidth(event.nativeEvent.layout.width)}
      className="overflow-hidden border-continuous mb-[40px]"
    >
      {description && (
        <Box className="overflow-hidden border-continuous p-[20px]">
          <ReferenceParagraph planLanguage={planLanguage}>{description}</ReferenceParagraph>
        </Box>
      )}
      <Box style={{ height: iframeHeight }} className="bg-light-grey justify-center">
        {failed ? (
          <Link
            href={url}
            accessibilityLabel={t('readingPlans.openVideo')}
            className="p-[20px] items-center gap-[12px]"
          >
            <Text className="text-grey">{t('readingPlans.videoUnavailable')}</Text>
            <Text className="text-primary font-bold">{t('readingPlans.openVideo')}</Text>
          </Link>
        ) : (
          <>
            {!ready && (
              <Box pointerEvents="none" className="absolute inset-0 items-center justify-center">
                <ActivityIndicator accessibilityLabel={t('Chargement...')} />
              </Box>
            )}
            {iframeWidth > 0 &&
              (videoId ? (
                <YoutubePlayer
                  height={iframeHeight}
                  width={iframeWidth}
                  videoId={videoId}
                  onReady={() => setReady(true)}
                  onError={() => setFailed(true)}
                />
              ) : (
                <PublisherVideo
                  url={url}
                  webUrl={webUrl}
                  poster={poster}
                  title={title}
                  onReady={() => setReady(true)}
                  onError={() => setFailed(true)}
                />
              ))}
          </>
        )}
      </Box>
    </Box>
  )
}

export default VideoSlice
