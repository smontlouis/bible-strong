import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { SvgProps } from 'react-native-svg'

// @ts-ignore
const SvgContainer = styled<RootStyles & SvgProps & { color: string }>(
  'svg'
  // @ts-ignore
)(({ color }) => ({
  cursor: 'pointer',
  color: color,
}))

// @ts-ignore
const Div = styled<RootStyles & { onClick?: () => void }>('div')(({ settings: { theme } }) => ({
  position: 'relative',
  display: 'inline-block',
  transform: 'translateY(5px)',
  marginRight: '8px',
  cursor: 'pointer',
}))

interface Props {
  color: string
  settings: RootState['user']['bible']['settings']
  onClick?: () => void
}

const BookmarkIcon = ({ color, settings, onClick }: Props) => {
  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  return (
    <Div settings={settings} onClick={handleClick}>
      <SvgContainer
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={color}
        stroke={color}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        settings={settings}
        color={color}
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </SvgContainer>
    </Div>
  )
}

export default BookmarkIcon
