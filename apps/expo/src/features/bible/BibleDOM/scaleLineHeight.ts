export const scaleLineHeight = (
  value: number,
  type: 'small' | 'normal' | 'large',
  fontSizeScale: number
): string => {
  // First apply fontSizeScale like in scaleFontSize
  const scaledValue = value + fontSizeScale * 0.1 * value

  // Then apply lineHeight multiplier
  const scale = {
    small: 0.8,
    normal: 1.1,
    large: 1.4,
  }

  return `${Math.round(scaledValue * scale[type])}px`
}
