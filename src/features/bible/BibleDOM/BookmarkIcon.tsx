import { styled } from 'goober'
import { RootStyles } from './BibleDOMWrapper'
import { RootState } from '~redux/modules/reducer'
import { SvgProps } from 'react-native-svg'
import { getDisabledStyles } from './disabledStyles'

const SvgContainer = styled<RootStyles & SvgProps & { color: string }>('svg')(({ color }) => ({
  cursor: 'pointer',
  color: color,
}))

const Div = styled<RootStyles & { onClick?: () => void; isDisabled?: boolean }>('div')(
  ({ settings: { theme }, isDisabled }) => ({
    position: 'relative',
    display: 'inline-block',
    transform: 'translateY(5px)',
    marginRight: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s ease-in-out',
    '&:active': {
      opacity: 0.6,
    },
    ...getDisabledStyles(isDisabled),
  })
)

interface Props {
  color: string
  settings: RootState['user']['bible']['settings']
  onClick?: () => void
  isDisabled?: boolean
}

const BookmarkIcon = ({ color, settings, onClick, isDisabled }: Props) => {
  const handleClick = () => {
    if (onClick) {
      onClick()
    }
  }

  return (
    <Div settings={settings} onClick={handleClick} isDisabled={isDisabled}>
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
