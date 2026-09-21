import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AVATARS,
  AVATAR_COLORS,
  DEFAULT_PROFILE,
  generateExplorerName,
  generateExplorerProfile,
  loadProfile,
  parseProfile,
  PROFILE_KEY,
  saveProfile,
} from './avatar-profile'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('local avatar profile', () => {
  it.each([0, 0.999])('generates an immediately usable profile from the preset palette (%s)', sample => {
    vi.spyOn(Math, 'random').mockReturnValue(sample)
    const profile = generateExplorerProfile()
    expect(profile.avatar).toBe(AVATARS[Math.floor(sample * AVATARS.length)].id)
    expect(profile.color).toBe(AVATAR_COLORS[Math.floor(sample * AVATAR_COLORS.length)])
    expect(parseProfile(profile)).toEqual(profile)
  })
  it('suggests English biblical names that can be accepted without editing', () => {
    const random = vi.spyOn(Math, 'random')
    random.mockReturnValueOnce(0).mockReturnValueOnce(0)
    expect(generateExplorerName()).toBe('Joyful Noah')
    random.mockReturnValueOnce(0.999).mockReturnValueOnce(0.999)
    const name = generateExplorerName()
    expect(name).toBe('Radiant Levi')
    expect(parseProfile({ ...DEFAULT_PROFILE, name })?.name).toBe(name)
  })
  it.each(['nova', 'short-slime', 'rounded-square', 'cloud', 'triangle'] as const)(
    'restores name, %s avatar and color after saving',
    avatar => {
      const values = new Map<string, string>()
      vi.stubGlobal('localStorage', {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      })
      expect(saveProfile({ avatar, name: '  Stéphane  ', color: '#73CDD0' })).toBe(true)
      expect(values.has(PROFILE_KEY)).toBe(true)
      expect(loadProfile()).toEqual({ avatar, name: 'Stéphane', color: '#73cdd0' })
    }
  )
  it('rejects unsupported avatars, malformed colors and blank names', () => {
    for (const override of [{ avatar: 'citrus' }, { color: 'red' }, { name: '   ' }]) {
      expect(
        parseProfile({ avatar: 'nova', name: 'Sam', color: '#ffffff', ...override })
      ).toBeNull()
    }
    expect(parseProfile(null)).toBeNull()
  })
  it('keeps corrupt or unavailable storage from crashing World', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{broken',
      setItem: () => {
        throw Error('blocked')
      },
    })
    expect(loadProfile()).toBeNull()
    expect(saveProfile({ avatar: 'nova', name: 'Sam', color: '#ffffff' })).toBe(false)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw Error('blocked')
      },
    })
    expect(loadProfile()).toBeNull()
  })
  it('bounds and sanitizes stored names', () => {
    expect(
      parseProfile({ avatar: 'nova', name: 'a'.repeat(50), color: '#ffffff' })?.name
    ).toHaveLength(24)
    expect(parseProfile({ avatar: 'nova', name: 'A\nB', color: '#ffffff' })?.name).toBe('AB')
  })
})
