import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { getLinkTypeIconComponent, getLinkTypeColor } from './LinkIcons'
import { getDisabledStyles } from './disabledStyles'

const Div = styled<RootStyles & { isDisabled?: boolean }>('div')(({ settings: { theme }, isDisabled }) => ({
  position: 'relative',
  display: 'inline-block',
  transform: 'translateY(5px)',
  marginRight: '10px',
  ...getDisabledStyles(isDisabled),
}))

const Count = styled<RootStyles>('div')(({ settings: { theme, colors } }) => ({
  background: colors[theme].primary,
  position: 'absolute',
  width: '13px',
  height: '13px',
  borderRadius: '13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'arial',
  fontSize: '10px',
  fontWeight: 'bold',
  color: 'white',
  bottom: '3px',
  right: '-5px',
}))

interface Props {
  count: number
  linkType?: string
  settings: RootState['user']['bible']['settings']
  onClick: () => void
  isDisabled?: boolean
}

const renderIcon = (linkType: string, onClick: () => void) => {
  const IconComponent = getLinkTypeIconComponent(linkType)
  const color = getLinkTypeColor(linkType)
  return <IconComponent size={24} color={color} onClick={onClick} />
}

const LinksCount = ({ count, linkType, settings, onClick, isDisabled }: Props) => (
  <Div settings={settings} isDisabled={isDisabled}>
    {renderIcon(linkType || 'website', onClick)}
    {count > 1 && <Count settings={settings}>{count}</Count>}
  </Div>
)

export default LinksCount
