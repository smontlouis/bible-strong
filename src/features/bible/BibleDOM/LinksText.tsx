import { styled } from 'goober'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { RootState } from '~redux/modules/reducer'
import { LinkedVerse, RootStyles } from './BibleDOMWrapper'

const Div = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    color: colors[theme].primary,
    fontSize: scaleFontSize(isParallel ? 16 : 19, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 26 : 32, fontSizeScale),
  })
)

const Verse = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale } }) => ({
    paddingLeft: '3px',
    fontSize: scaleFontSize(isParallel ? 9 : 14, fontSizeScale),
  })
)

const LinkTypeIndicator = styled('span')<RootStyles & { indicatorColor: string }>(
  ({ indicatorColor, settings: { fontSizeScale } }) => ({
    color: indicatorColor,
    marginRight: '4px',
    fontSize: scaleFontSize(14, fontSizeScale),
  })
)

interface Props {
  linksText: LinkedVerse[]
  settings: RootState['user']['bible']['settings']
  onClick: (x: string) => void
  isParallel?: boolean
}

const getLinkTypeIndicator = (linkType: string): { symbol: string; color: string } => {
  switch (linkType) {
    case 'youtube':
      return { symbol: '▶', color: '#FF0000' }
    case 'twitter':
      return { symbol: '𝕏', color: '#1DA1F2' }
    case 'instagram':
      return { symbol: '📷', color: '#E4405F' }
    case 'tiktok':
      return { symbol: '♪', color: '#000000' }
    case 'spotify':
      return { symbol: '♫', color: '#1DB954' }
    default:
      return { symbol: '🔗', color: '#888888' }
  }
}

const LinksText = ({ linksText, settings, onClick, isParallel }: Props) => {
  return (
    <span>
      {linksText.map(link => {
        const indicator = getLinkTypeIndicator(link.linkType)
        return (
          <Div
            key={link.key}
            settings={settings}
            isParallel={isParallel}
            onClick={() => onClick(link.key)}
          >
            [
            <LinkTypeIndicator settings={settings} indicatorColor={indicator.color}>
              {indicator.symbol}
            </LinkTypeIndicator>
            <Verse isParallel={isParallel} settings={settings}>
              ({link.verses}){' '}
            </Verse>
            <span>{truncate(link.title, 15)}</span>]
          </Div>
        )
      })}
    </span>
  )
}

export default LinksText
