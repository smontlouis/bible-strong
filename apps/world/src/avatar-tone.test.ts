import { describe, expect, it } from 'vitest'
import { avatarTint, sepiaTone } from './avatar-tone'

describe('sepiaTone', () => {
  it('leaves a colour unchanged at zero', () => {
    expect(sepiaTone(0)(0x2a7fd4)).toBe(0x2a7fd4)
  })

  it('turns a vivid colour into its sepia print', () => {
    // Pure red: 0.393 × 255, 0.349 × 255, 0.272 × 255.
    expect(sepiaTone(1)(0xff0000)).toBe((100 << 16) | (89 << 8) | 69)
  })

  it('keeps explorers apart once aged', () => {
    const tone = sepiaTone(0.65)
    expect(tone(0xe5484d)).not.toBe(tone(0x3e9bd8))
  })
})

describe('avatarTint', () => {
  it('reads the profile colour, aged by the world if it asks', () => {
    expect(avatarTint('#ff0000')).toBe(0xff0000)
    expect(avatarTint('#ff0000', sepiaTone(1))).toBe((100 << 16) | (89 << 8) | 69)
  })
})
