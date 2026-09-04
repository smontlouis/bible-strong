type Props = {
  color: string
  backgroundColor: string
}

const UntranslatedStrongMarker = ({ color, backgroundColor }: Props) => (
  <span
    aria-hidden
    style={{
      display: 'inline-flex',
      width: '1em',
      height: '1em',
      borderRadius: '50%',
      backgroundColor,
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: '0.12em',
      flexShrink: 0,
    }}
  >
    <span
      style={{
        display: 'block',
        width: '0.5em',
        height: '0.5em',
        borderRadius: '50%',
        backgroundColor: color,
      }}
    />
  </span>
)

export default UntranslatedStrongMarker
