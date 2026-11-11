import { useId } from 'react'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

type Props = {
  /** Diameter in points; the mark never goes below 20. */
  size?: number
}

/**
 * The Bible Strong mark, drawn from `design-system/project/assets/Logos/bible-strong-mark.svg`:
 * a white disc, a grey ring lit from the top and a dot in `blue-brand`. It carries its own disc,
 * so it reads on any ground and keeps its colours in every theme.
 */
export default function BrandMark({ size = 24 }: Props) {
  // A gradient id is global to the document on the web: each mark names its own.
  const ring = `bs-mark-ring-${useId().replace(/:/g, '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 102 102" aria-hidden>
      <Defs>
        <RadialGradient id={ring} cx="50%" cy="0%" fx="50%" fy="0%" r="100%">
          <Stop offset="0%" stopColor="#000000" stopOpacity={0.2} />
          <Stop offset="100%" stopColor="#000000" stopOpacity={0.5} />
        </RadialGradient>
      </Defs>
      <Circle cx={51} cy={51} r={51} fill="#ffffff" />
      <Circle cx={51} cy={51} r={47.13} fill="none" stroke={`url(#${ring})`} strokeWidth={7.74} />
      <Circle cx={51} cy={51} r={23.5} fill="#5983f0" />
    </Svg>
  )
}
