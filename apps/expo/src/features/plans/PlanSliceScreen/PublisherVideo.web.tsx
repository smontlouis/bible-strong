import type { VideoSlice } from '~common/types'

type Props = Pick<VideoSlice, 'url' | 'webUrl' | 'poster' | 'title'> & {
  onError: () => void
  onReady: () => void
}

const PublisherVideo = ({ url, webUrl, poster, title, onError, onReady }: Props) => (
  <video
    src={webUrl ?? url}
    poster={poster}
    aria-label={title}
    controls
    playsInline
    preload="metadata"
    onLoadedMetadata={onReady}
    onError={onError}
    style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
  />
)

export default PublisherVideo
