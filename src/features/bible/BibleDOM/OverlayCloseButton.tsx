import Feather from '@expo/vector-icons/Feather'

type Props = {
  label: string
  color: string
  backgroundColor: string
  onClose: () => void
}

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
      borderRadius: 19,
      background: backgroundColor,
      color,
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    <Feather name="x" size={21} />
  </button>
)

export default OverlayCloseButton
