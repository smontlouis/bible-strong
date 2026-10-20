import Feather from '@expo/vector-icons/Feather'
import { floatingShadow } from '~common/ui/surfaces'

type Props = {
  label: string
  color: string
  backgroundColor: string
  onClose: () => void
}

/** Floats above an overlay, so it takes the app's one floating shadow. */
const OverlayCloseButton = ({ label, color, backgroundColor, onClose }: Props) => (
  <button
    type="button"
    aria-label={label}
    onClick={event => {
      event.stopPropagation()
      onClose()
    }}
    style={{
      position: 'fixed',
      top: 'max(24px, calc(var(--safe-area-top, 0px) + 10px))',
      right: 14,
      zIndex: 2,
      display: 'grid',
      width: 38,
      height: 38,
      placeItems: 'center',
      margin: 0,
      padding: 0,
      border: 0,
      borderRadius: '50%',
      background: backgroundColor,
      color,
      ...floatingShadow,
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    <Feather name="x" size={21} color={color} />
  </button>
)

export default OverlayCloseButton
