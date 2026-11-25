import { Canvas, Fill, Shader, Skia, type Uniforms } from '@shopify/react-native-skia'
import { useEffect } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

/**
 * A sphere of slowly swirling colour, lit from above. The shader comes from Reacticx's Nebula Orb
 * (rit3zh/reacticx, MIT). Here its colours fade into the next ones instead of jumping, and it
 * stands still while paused or when the system asks for less motion.
 */

export type NebulaOrbProps = {
  size: number
  /** The deep colour, at the foot of the sphere. */
  color: string
  /** The light at its top. */
  highlightColor: string
  /** It stops swirling and keeps its last frame. */
  paused?: boolean
  speed?: number
  style?: StyleProp<ViewStyle>
}

const SHADER = `
uniform float2 uResolution;
uniform float  uTime;
uniform float3 uColor;
uniform float3 uHighlight;
uniform float  uTurbulence;
uniform float  uScale;
uniform float  uContrast;
uniform float  uEdgeSoftness;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453123);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + float2(0.0, 0.0)), hash(i + float2(1.0, 0.0)), u.x),
    mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(float2 seed) {
  float2 p = seed;
  float v = 0.0;
  float a = 0.6;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / uResolution;
  float2 guv = float2(uv.x, 1.0 - uv.y);

  float t = uTime * 0.22;
  float2 drift = float2(
    sin(t) + 0.6 * sin(t * 1.7 + 1.3),
    cos(t * 0.8) + 0.6 * cos(t * 1.3 + 2.1));
  float2 p = float2(guv.x * 1.8, guv.y) * uScale + drift * 0.7;
  float2 q = float2(fbm(p + drift), fbm(p + float2(3.2, 1.5) - drift));
  float f = fbm(p + uTurbulence * q);

  float g = clamp(1.0 - guv.y, 0.0, 1.0);
  float anchor = smoothstep(0.0, 0.3, guv.y);
  float shade = clamp(g + (f - 0.5) * uContrast * anchor, 0.0, 1.0);

  float3 light = mix(uHighlight, uColor, 0.5);
  float3 col = uHighlight;
  col = mix(col, light, smoothstep(0.28, 0.52, shade));
  col = mix(col, uColor, smoothstep(0.58, 0.88, shade));

  float edge = smoothstep(0.5, 0.5 - uEdgeSoftness, distance(uv, float2(0.5)));
  return half4(half3(col) * half(edge), half(edge));
}
`

const orbEffect = Skia.RuntimeEffect.Make(SHADER)

const COLOR_FADE_MS = 700

const toRgb = (color: string): [number, number, number] => {
  const c = Skia.Color(color)
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0]
}

/** A colour that fades to each new value it is given. */
const useFadingRgb = (color: string) => {
  const from = useSharedValue(toRgb(color))
  const to = useSharedValue(toRgb(color))
  const progress = useSharedValue(1)
  useEffect(() => {
    const next = toRgb(color)
    const p = progress.get()
    const a = from.get()
    const b = to.get()
    // It starts from where the last fade had got to.
    from.set([0, 1, 2].map(i => a[i]! + (b[i]! - a[i]!) * p) as [number, number, number])
    to.set(next)
    progress.set(0)
    progress.set(withTiming(1, { duration: COLOR_FADE_MS, easing: Easing.inOut(Easing.quad) }))
  }, [color, from, to, progress])
  return useDerivedValue(() => {
    const p = progress.get()
    const a = from.get()
    const b = to.get()
    return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p]
  })
}

const NebulaOrb = ({
  size,
  color,
  highlightColor,
  paused = false,
  speed = 1,
  style,
}: NebulaOrbProps) => {
  const reduceMotion = useReducedMotion()
  const time = useSharedValue(0)
  const frame = useFrameCallback(info => {
    time.set(time.get() + (info.timeSincePreviousFrame ?? 16) / 1000)
  }, false)
  useEffect(() => {
    frame.setActive(!paused && !reduceMotion)
  }, [frame, paused, reduceMotion])

  const colorRgb = useFadingRgb(color)
  const highlightRgb = useFadingRgb(highlightColor)

  const uniforms = useDerivedValue<Uniforms>(() => ({
    uResolution: [size, size],
    uTime: time.get() * speed,
    uColor: colorRgb.get(),
    uHighlight: highlightRgb.get(),
    uTurbulence: 1.2,
    uScale: 1,
    uContrast: 0.8,
    uEdgeSoftness: Math.min(0.04, 1.5 / size),
  }))

  return (
    <View style={[{ width: size, height: size }, style]}>
      {orbEffect ? (
        <Canvas style={{ flex: 1 }}>
          <Fill>
            <Shader source={orbEffect} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : (
        <View style={{ flex: 1, borderRadius: size / 2, backgroundColor: color }} />
      )}
    </View>
  )
}

export default NebulaOrb
