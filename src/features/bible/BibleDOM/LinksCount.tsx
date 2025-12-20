import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'

const Div = styled<RootStyles>('div')(({ settings: { theme } }) => ({
  position: 'relative',
  display: 'inline-block',
  transform: 'translateY(5px)',
  marginRight: '10px',
}))

const Count = styled<RootStyles>('div')(({ settings: { theme, colors } }) => ({
  background: colors[theme].primary,
  position: 'absolute',
  width: '15px',
  height: '15px',
  borderRadius: '15px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'arial',
  fontSize: '13px',
  fontWeight: 'bold',
  color: 'white',
  bottom: '0',
  right: '0px',
}))

interface Props {
  count: number
  isYouTube?: boolean
  settings: RootState['user']['bible']['settings']
  onClick: () => void
}

// Link icon SVG path
const LinkIcon = ({ settings, onClick }: { settings: Props['settings']; onClick: () => void }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

// YouTube icon SVG
const YouTubeIcon = ({ onClick }: { onClick: () => void }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="#FF0000"
    onClick={onClick}
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

const LinksCount = ({ count, isYouTube, settings, onClick }: Props) => (
  <Div settings={settings}>
    {isYouTube ? (
      <YouTubeIcon onClick={onClick} />
    ) : (
      <LinkIcon settings={settings} onClick={onClick} />
    )}
    {count > 1 && <Count settings={settings}>{count}</Count>}
  </Div>
)

export default LinksCount
