import React, { useState } from 'react'
import YoutubePlayer from '~helpers/react-native-youtube-iframe'
import Box from '~common/ui/Box'

import { Plan, VideoSlice as VideoSliceProps } from 'src/common/types'
import ReferenceParagraph from './ReferenceParagraph'

type Props = VideoSliceProps & {
  planLanguage?: Plan['lang']
}

const VideoSlice = ({ title, description, url, planLanguage }: Props) => {
  const [iframeWidth, setIframeWidth] = useState(0)
  const iframeHeight = (iframeWidth * 9) / 16
  const videoId = url.replace('https://www.youtube.com/watch?v=', '')
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
      <YoutubePlayer
        height={iframeHeight}
        width={iframeWidth}
        videoId={videoId}
        // onChangeState={event => console.log(event)}
        onReady={() => console.log('[Plans] Video ready')}
        onError={e => console.log('[Plans] Video error:', e)}
        // onPlaybackQualityChange={q => console.log(q)}
      />
    </Box>
  )
}

export default VideoSlice
