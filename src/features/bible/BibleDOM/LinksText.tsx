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

const YouTubeIndicator = styled('span')<RootStyles>(({ settings: { fontSizeScale } }) => ({
  color: '#FF0000',
  marginRight: '4px',
  fontSize: scaleFontSize(14, fontSizeScale),
}))

const LinkIndicator = styled('span')<RootStyles>(
  ({ settings: { fontSizeScale, theme, colors } }) => ({
    color: colors[theme].grey,
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

const LinksText = ({ linksText, settings, onClick, isParallel }: Props) => {
  return (
    <span>
      {linksText.map(link => (
        <Div
          key={link.key}
          settings={settings}
          isParallel={isParallel}
          onClick={() => onClick(link.key)}
        >
          [
          {link.isYouTube ? (
            <YouTubeIndicator settings={settings}>&#9654;</YouTubeIndicator>
          ) : (
            <LinkIndicator settings={settings}>&#128279;</LinkIndicator>
          )}
          <Verse isParallel={isParallel} settings={settings}>
            ({link.verses}){' '}
          </Verse>
          <span>{truncate(link.title, 15)}</span>]
        </Div>
      ))}
    </span>
  )
}

export default LinksText
