import { Canvas, Fill, Shader, Skia, type Uniforms } from '@shopify/react-native-skia'
import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import {
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated'

/**
 * A border of moving light around its content. The shader comes from Reacticx's Chroma Ring
 * (rit3zh/reacticx, MIT). Here it takes the size of what it holds, and stands still and dim while
 * it is not active or when the system asks for less motion.
 */

export type ChromaRingProps = {
  borderRadius: number
  borderWidth?: number
  /** The ring where no light runs. */
  base: string
  /** The light running round it. */
  glow: string
  /** Inside the ring. */
  background: string
  /** The light runs; otherwise the ring rests, dimmed. */
  active?: boolean
  speed?: number
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

const SHADER = `
uniform float2 iResolution;
uniform float iTime;
uniform float borderWidth;
uniform float borderRadius;
uniform float speed;
uniform float3 baseColor;
uniform float3 glowColor;

const float PI = 3.14159265359;

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec4 main(vec2 fragCoord) {
  vec2 pixelPos = fragCoord - iResolution * 0.5;
  vec2 halfSize = iResolution * 0.5 - vec2(1.0);
  float r = min(borderRadius, min(halfSize.x, halfSize.y));
  float dist = sdRoundedBox(pixelPos, halfSize, r);

  float borderMask = 1.0 - smoothstep(0.0, 1.0, dist)
                   - (1.0 - smoothstep(-borderWidth - 1.0, -borderWidth, dist));
  borderMask = clamp(borderMask, 0.0, 1.0);

  float angle = atan(pixelPos.y, pixelPos.x);
  float perimeter = (angle + PI) / (2.0 * PI);
  float t = iTime * speed;

  float lights = 0.0;
  float p1 = fract(perimeter - t * 0.15);
  lights += pow(max(0.0, 1.0 - abs(p1 - 0.5) * 8.0), 2.0);
  float p2 = fract(perimeter - t * 0.12 + 0.33);
  lights += pow(max(0.0, 1.0 - abs(p2 - 0.5) * 8.0), 2.0);
  float p3 = fract(perimeter - t * 0.1 + 0.66);
  lights += pow(max(0.0, 1.0 - abs(p3 - 0.5) * 8.0), 2.0);

  float sparkle = noise(vec2(perimeter * 20.0, t * 2.0)) * 0.5;
  sparkle += noise(vec2(perimeter * 40.0 + 100.0, t * 3.0)) * 0.3;

  vec3 rainbow;
  float hueShift = perimeter * 2.0 + t * 0.5;
  rainbow.r = 0.5 + 0.5 * sin(hueShift * PI * 2.0);
  rainbow.g = 0.5 + 0.5 * sin(hueShift * PI * 2.0 + PI * 0.66);
  rainbow.b = 0.5 + 0.5 * sin(hueShift * PI * 2.0 + PI * 1.33);

  vec3 borderColor = baseColor;
  vec3 lightColor = mix(glowColor, rainbow, 0.6);
  borderColor += lightColor * lights * 1.5;
  borderColor += glowColor * sparkle * 0.3;
  borderColor += baseColor * 0.3;

  float alpha = clamp(borderMask * (0.4 + lights * 0.6 + sparkle * 0.2), 0.0, 1.0);
  return vec4(borderColor * borderMask, alpha);
}
`

const ringEffect = Skia.RuntimeEffect.Make(SHADER)

const toRgb = (color: string) => {
  const c = Skia.Color(color)
  return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0]
}

const ChromaRing = ({
  borderRadius,
  borderWidth = 2,
  base,
  glow,
  background,
  active = true,
  speed = 1,
  children,
  style,
}: ChromaRingProps) => {
  const reduceMotion = useReducedMotion()
  const [layout, setLayout] = useState({ width: 0, height: 0 })
  const time = useSharedValue(0)
  const frame = useFrameCallback(info => {
    time.set(time.get() + (info.timeSincePreviousFrame ?? 16) / 1000)
  }, false)
  useEffect(() => {
    frame.setActive(active && !reduceMotion)
  }, [frame, active, reduceMotion])

  const baseRgb = toRgb(base)
  const glowRgb = toRgb(glow)
  const uniforms = useDerivedValue<Uniforms>(() => ({
    iResolution: [layout.width, layout.height],
    iTime: time.get(),
    borderWidth,
    borderRadius,
    speed,
    baseColor: baseRgb,
    glowColor: glowRgb,
  }))

  return (
    <View
      style={[{ borderRadius, overflow: 'hidden', padding: borderWidth }, style]}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout
        setLayout({ width, height })
      }}
    >
      {ringEffect && layout.width > 0 ? (
        <Canvas style={[StyleSheet.absoluteFill, { opacity: active ? 1 : 0.4 }]}>
          <Fill>
            <Shader source={ringEffect} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} />
      )}
      <View
        style={{
          backgroundColor: background,
          borderRadius: Math.max(0, borderRadius - borderWidth),
        }}
      >
        {children}
      </View>
    </View>
  )
}

export default ChromaRing
