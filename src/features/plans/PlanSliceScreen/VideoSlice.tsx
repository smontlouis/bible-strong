import React from 'react'
// import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import YoutubePlayer from 'react-native-youtube-iframe'

import Box from '~common/ui/Box'
import { wp } from '~helpers/utils'

import { Plan, VideoSlice as VideoSliceProps } from 'src/common/types'
import ReferenceParagraph from './ReferenceParagraph'

const iframeWidth = wp(100) > 600 ? 600 : wp(100)
const iframeHeight = (iframeWidth * 9) / 16

type Props = VideoSliceProps & {
  planLanguage?: Plan['lang']
}

const VideoSlice = ({ title, description, url, planLanguage }: Props) => {
  const videoId = url.replace('https://www.youtube.com/watch?v=', '')
  return (
    <Box marginBottom={40}>
      {description && (
        <Box padding={20}>
          <ReferenceParagraph planLanguage={planLanguage}>{description}</ReferenceParagraph>
        </Box>
      )}
      <YoutubePlayer
        height={iframeHeight}
        width={iframeWidth}
        videoId={videoId}
        // onChangeState={event => console.log(event)}
        onReady={() => console.log('[Plans] Video ready')}
        onError={(e: string) => console.log('[Plans] Video error:', e)}
        // onPlaybackQualityChange={q => console.log(q)}
      />
    </Box>
  )
}

export default VideoSlice
