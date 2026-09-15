import { WebView } from 'react-native-webview'
import type { VideoSlice } from '~common/types'

type Props = Pick<VideoSlice, 'url' | 'webUrl' | 'poster' | 'title'> & {
  onError: () => void
  onReady: () => void
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Publisher-hosted HLS playback, without downloading or rehosting the video. */
const PublisherVideo = ({ url, poster, title, onError, onReady }: Props) => (
  <WebView
    originWhitelist={['https://*', 'about:blank']}
    source={{
      html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#000"><video controls playsinline preload="metadata" aria-label="${escapeAttribute(title)}" poster="${escapeAttribute(poster ?? '')}" src="${escapeAttribute(url)}" style="width:100%;height:100vh" onloadedmetadata="window.ReactNativeWebView.postMessage('ready')" onerror="window.ReactNativeWebView.postMessage('error')"></video></body></html>`,
      baseUrl: 'https://www.bible.com',
    }}
    allowsInlineMediaPlayback
    allowsFullscreenVideo
    mediaPlaybackRequiresUserAction
    onError={onError}
    onHttpError={onError}
    onLoadEnd={onReady}
    onMessage={event => {
      if (event.nativeEvent.data === 'error') onError()
      if (event.nativeEvent.data === 'ready') onReady()
    }}
    style={{ flex: 1, backgroundColor: '#000' }}
  />
)

export default PublisherVideo
