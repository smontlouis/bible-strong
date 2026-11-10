import { describe, expect, it } from 'vitest'
import { devicePlatform } from './devicePlatform'

const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

describe('System of the reader’s device', () => {
  it('tells the phones and tablets apart', () => {
    expect(
      devicePlatform({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      })
    ).toBe('ios')
    expect(
      devicePlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
      })
    ).toBe('android')
  })

  it('takes an iPad that asks for the desktop site for an iPad', () => {
    expect(devicePlatform({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(
      'ios'
    )
    expect(devicePlatform({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(
      'mac'
    )
  })

  it('tells the computers apart', () => {
    expect(
      devicePlatform({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      })
    ).toBe('windows')
    expect(
      devicePlatform({
        userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
      })
    ).toBe('linux')
  })

  it('believes an Android browser over the platform it reports', () => {
    expect(
      devicePlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
    ).toBe('android')
  })

  it('sends a Chromebook to Google Play', () => {
    expect(
      devicePlatform({
        userAgent:
          'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      })
    ).toBe('android')
  })

  it('says nothing of a device it does not know', () => {
    expect(devicePlatform({ userAgent: 'curl/8.7.1' })).toBeUndefined()
  })
})
