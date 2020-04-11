import React from 'react'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'

import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'
import { wp } from '~helpers/utils'

import { VideoSlice as VideoSliceProps } from 'src/common/types'

const iframeWidth = wp(100) > 600 ? 600 : wp(100)
const iframeHeight = (iframeWidth * 9) / 16

const VideoSlice = ({ title, description, url }: VideoSliceProps) => {
  const videoId = url.replace('https://www.youtube.com/watch?v=', '')
  return (
    <Box marginBottom={40}>
      {description && (
        <Box padding={20}>
          <Paragraph>{description}</Paragraph>
        </Box>
      )}
      <YoutubePlayer
        height={iframeHeight}
        width={iframeWidth}
        videoId={videoId}
        onChangeState={event => console.log(event)}
        onReady={() => console.log('ready')}
        onError={e => console.log(e)}
        onPlaybackQualityChange={q => console.log(q)}
        placeholder={title}
      />
    </Box>
  )
}

export default VideoSlice
