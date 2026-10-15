// Avatars take the colour their explorer chose; a world in an old print may age it. The colour
// moves towards its sepia version, so explorers stay recognisable but belong to the picture.

export type AvatarTone = (color: number) => number

/** `amount` of the way from `color` to its sepia print (the classic sepia matrix). */
export function sepiaTone(amount: number): AvatarTone {
  return color => {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff
    const sepia = [
      Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b),
      Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b),
      Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b),
    ]
    const [tr, tg, tb] = [r, g, b].map((channel, i) => Math.round(channel + (sepia[i] - channel) * amount))
    return (tr << 16) | (tg << 8) | tb
  }
}

/** The tint for an avatar colour written as `#rrggbb`. */
export function avatarTint(color: string, tone?: AvatarTone) {
  const value = Number.parseInt(color.slice(1), 16)
  return tone ? tone(value) : value
}
