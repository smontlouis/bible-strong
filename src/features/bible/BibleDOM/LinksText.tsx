import { styled } from 'goober'
import truncate from './truncate'
import { scaleFontSize } from './scaleFontSize'
import { RootState } from '~redux/modules/reducer'
import { LinkedVerse, RootStyles } from './BibleDOMWrapper'
import { getLinkTypeIconComponent, getLinkTypeColor } from './LinkIcons'

const Div = styled('span')<RootStyles & { isParallel?: boolean }>(
  ({ isParallel, settings: { fontSizeScale, theme, colors, fontFamily } }) => ({
    fontFamily,
    webkitTouchCallout: 'none',
    mozUserSelect: 'none',
    msUserSelect: 'none',
    khtmlUserSelect: 'none',
    webkitUserSelect: 'none',
    fontSize: scaleFontSize(isParallel ? 10 : 14, fontSizeScale),
    lineHeight: scaleFontSize(isParallel ? 18 : 26, fontSizeScale),
    backgroundColor: colors[theme].reverse,
    boxShadow: `0 0 10px 0 rgba(0, 0, 0, 0.2)`,
    borderRadius: '8px',
    padding: '4px 8px',
    wordBreak: 'break-word',
    marginRight: '4px',
    marginLeft: '4px',

    '&:active': {
      opacity: 0.4,
    },
  })
)

const LinkTypeIndicator = styled('span')<RootStyles>(({ settings: { fontSizeScale } }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  marginRight: '4px',
  verticalAlign: 'middle',
  '& svg': {
    width: scaleFontSize(20, fontSizeScale),
    height: scaleFontSize(20, fontSizeScale),
  },
}))

interface Props {
  linksText: LinkedVerse[]
  settings: RootState['user']['bible']['settings']
  onClick: (x: string) => void
  isParallel?: boolean
}

const renderLinkTypeIcon = (linkType: string, size: number) => {
  const IconComponent = getLinkTypeIconComponent(linkType)
  const color = getLinkTypeColor(linkType)
  return <IconComponent size={size} color={color} />
}

const calculateIconSize = (baseSize: number, scale: number): number =>
  baseSize + scale * 0.1 * baseSize

const LinksText = ({ linksText, settings, onClick, isParallel }: Props) => {
  const iconSize = calculateIconSize(isParallel ? 12 : 14, settings.fontSizeScale)

  return (
    <span>
      {linksText.map(link => {
        return (
          <Div
            key={link.key}
            settings={settings}
            isParallel={isParallel}
            onClick={() => onClick(link.key)}
          >
            <LinkTypeIndicator settings={settings}>
              {renderLinkTypeIcon(link.linkType, iconSize)}
            </LinkTypeIndicator>
            <span>{truncate(link.title, 36)}</span>
          </Div>
        )
      })}
    </span>
  )
}

export default LinksText
