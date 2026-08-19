import { forwardRef, useImperativeHandle } from 'react'
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native'

import Box from '~common/ui/Box'

type YoutubeIframeProps = {
  height?: number
  width?: DimensionValue
  videoId?: string
  playList?: string | string[]
  play?: boolean
  mute?: boolean
  onError?: (error: string | undefined) => void
  onReady?: () => void
  initialPlayerParams?: Record<string, string | number | boolean | undefined>
  viewContainerStyle?: StyleProp<ViewStyle>
  webViewStyle?: StyleProp<ViewStyle>
  webviewStyle?: StyleProp<ViewStyle>
  webViewProps?: object
  volume?: number
  playbackRate?: number
  playListStartIndex?: number
  forceAndroidAutoplay?: boolean
  onChangeState?: (event: string | undefined) => void
  onPlaybackQualityChange?: (quality: string) => void
  onPlaybackRateChange?: (playbackRate: number) => void
  placeholder?: string
}

export type YoutubeIframeRef = {
  getDuration: () => Promise<unknown>
  getCurrentTime: () => Promise<unknown>
  isMuted: () => Promise<unknown>
  getVolume: () => Promise<unknown>
  getPlaybackRate: () => Promise<unknown>
  getAvailablePlaybackRates: () => Promise<unknown>
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

const YoutubeIframe = forwardRef<YoutubeIframeRef, YoutubeIframeProps>(
  ({ height = 360, width = '100%', videoId, play, mute, onError, onReady }, ref) => {
    useImperativeHandle(ref, () => ({
      getDuration: async () => undefined,
      getCurrentTime: async () => undefined,
      isMuted: async () => Boolean(mute),
      getVolume: async () => undefined,
      getPlaybackRate: async () => undefined,
      getAvailablePlaybackRates: async () => [],
      seekTo: () => undefined,
    }))

    const params = new URLSearchParams({
      playsinline: '1',
      rel: '0',
      ...(play ? { autoplay: '1' } : {}),
      ...(mute ? { mute: '1' } : {}),
    })
    const source = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
      videoId ?? ''
    )}?${params}`

    return (
      <Box width={width} height={height} overflow="hidden" bg="lightGrey">
        <iframe
          src={source}
          title="YouTube video player"
          width="100%"
          height="100%"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ border: 0 }}
          onLoad={onReady}
          onError={() => onError?.('iframe-load-failed')}
        />
      </Box>
    )
  }
)

YoutubeIframe.displayName = 'YoutubeIframe'

export default YoutubeIframe
