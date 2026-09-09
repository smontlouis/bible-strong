import Svg, { Path } from 'react-native-svg'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { AnnotationType } from './hooks/useAnnotationMode'

/** Scalable ink strokes shared by the tool samples and the annotation preview. */
export const AnnotationMark = ({ type, color }: { type: AnnotationType; color: string }) => (
  <Svg width="100%" height="100%" viewBox="0 0 200 60" preserveAspectRatio="none">
    {type === 'background' ? (
      <Path
        d="M8 13 L44 10 L83 12 L124 9 L164 11 L193 9 L190 19 L196 25 L192 35 L195 47 L150 49 L109 47 L67 51 L29 48 L5 50 L8 38 L4 30 L9 22 Z"
        fill={color}
        fillOpacity={0.35}
      />
    ) : type === 'circle' ? (
      <Path
        d="M154 8 C112 0 39 3 14 20 C-7 35 19 52 66 55 C120 61 185 51 192 34 C204 12 148 1 92 5 M18 43 C49 59 125 58 172 47"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      <Path
        d="M10 50 Q92 53 190 49"
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    )}
  </Svg>
)

const AnnotationPreview = ({ type, color }: { type: AnnotationType; color: string }) => (
  <Box className="w-[68px] max-w-full h-[30px] items-center justify-center">
    <Box className="absolute top-0 left-2 right-2 bottom-0" pointerEvents="none">
      <AnnotationMark type={type} color={color} />
    </Box>
    <Text className="text-[22px] leading-[30px] font-bold">Aa</Text>
  </Box>
)

export default AnnotationPreview
