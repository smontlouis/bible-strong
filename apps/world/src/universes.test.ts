import { describe, expect, it } from 'vitest'
import { canonicalPath, universeAt, universes } from './universes'

describe('world addresses', () => {
  it('opens each world at its own address, and the archipelago elsewhere', () => {
    expect(universeAt('/')).toBe('archipelago')
    expect(universeAt('/valence-1876')).toBe('valence-1876')
    expect(universeAt('/valence-1876/')).toBe('valence-1876')
    expect(universeAt('/somewhere')).toBe('archipelago')
    for (const [id, world] of Object.entries(universes)) expect(universeAt(world.path)).toBe(id)
  })

  it('drops the trailing slash of world addresses only', () => {
    expect(canonicalPath('/valence-1876/')).toBe('/valence-1876')
    expect(canonicalPath('/valence-1876')).toBe('/valence-1876')
    expect(canonicalPath('/')).toBe('/')
  })
})
