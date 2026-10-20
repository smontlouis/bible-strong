import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { getLinkTypeIconComponent, getLinkTypeColor } from './LinkIcons'
import { getDisabledStyles } from './disabledStyles'
import { referenceHalo } from './referenceHalo'

const Div = styled('span')<RootStyles & { isDisabled?: boolean }>(
  ({ settings: { theme, colors }, isDisabled }) => ({
    backgroundColor: colors[theme].reverse,
    ...referenceHalo(theme),
    borderRadius: '8px',
    padding: '4px 8px 4px 6px',
    wordBreak: 'break-word',
    marginRight: '4px',
    marginLeft: '4px',
    position: 'relative',
    display: 'inline-block',

    '&:active': {
      opacity: 0.6,
    },
    ...getDisabledStyles(isDisabled),
  })
)

const Count = styled<RootStyles>('div')(({ settings: { theme, colors } }) => ({
  background: colors[theme].grey,
  position: 'absolute',
  width: '12px',
  height: '12px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'arial',
  fontSize: '10px',
  color: colors[theme].reverse,
  bottom: '0',
  right: '0px',
}))

interface Props {
  count: number
  linkType?: string
  settings: RootState['user']['bible']['settings']
  onClick: () => void
  isDisabled?: boolean
}

const renderIcon = (linkType: string) => {
  const IconComponent = getLinkTypeIconComponent(linkType)
  const color = getLinkTypeColor(linkType)
  return <IconComponent size={16} color={color} />
}

const LinksCount = ({ count, linkType, settings, onClick, isDisabled }: Props) => (
  <Div settings={settings} onClick={() => onClick()} isDisabled={isDisabled}>
    {renderIcon(linkType || 'website')}
    <Count settings={settings}>{count}</Count>
  </Div>
)

export default LinksCount
