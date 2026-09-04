const RGB_COLOR_PATTERN =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i
const HEX_COLOR_PATTERN = /^#([\da-f]{3}|[\da-f]{6})$/i

export const withColorAlpha = (color: string, alpha: number): string => {
  const normalizedAlpha = Math.min(Math.max(alpha, 0), 1)
  const rgbMatch = color.match(RGB_COLOR_PATTERN)

  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${normalizedAlpha})`
  }

  const hexMatch = color.match(HEX_COLOR_PATTERN)
  if (hexMatch) {
    const hex = hexMatch[1].length === 3 ? hexMatch[1].replace(/(.)/g, '$1$1') : hexMatch[1]
    const red = Number.parseInt(hex.slice(0, 2), 16)
    const green = Number.parseInt(hex.slice(2, 4), 16)
    const blue = Number.parseInt(hex.slice(4, 6), 16)

    return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`
  }

  return `color-mix(in srgb, ${color} ${normalizedAlpha * 100}%, transparent)`
}
