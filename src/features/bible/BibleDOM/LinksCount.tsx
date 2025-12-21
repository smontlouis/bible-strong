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
  linkType?: string
  settings: RootState['user']['bible']['settings']
  onClick: () => void
}

// Link icon SVG path
const LinkIcon = ({ onClick }: { onClick: () => void }) => (
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
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF0000" onClick={onClick}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

// Twitter/X icon SVG
const TwitterIcon = ({ onClick }: { onClick: () => void }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="#1DA1F2" onClick={onClick}>
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
  </svg>
)

// Instagram icon SVG
const InstagramIcon = ({ onClick }: { onClick: () => void }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E4405F" strokeWidth="2" onClick={onClick}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

const getLinkTypeIcon = (linkType: string, onClick: () => void) => {
  switch (linkType) {
    case 'youtube':
      return <YouTubeIcon onClick={onClick} />
    case 'twitter':
      return <TwitterIcon onClick={onClick} />
    case 'instagram':
      return <InstagramIcon onClick={onClick} />
    default:
      return <LinkIcon onClick={onClick} />
  }
}

const LinksCount = ({ count, linkType, settings, onClick }: Props) => (
  <Div settings={settings}>
    {getLinkTypeIcon(linkType || 'website', onClick)}
    {count > 1 && <Count settings={settings}>{count}</Count>}
  </Div>
)

export default LinksCount
