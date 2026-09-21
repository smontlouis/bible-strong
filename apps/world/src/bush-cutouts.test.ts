import { describe, expect, it } from 'vitest'
import { cleanBushGround, isReactiveBush } from './bush-cutouts'

describe('reviewed bush cutouts', () => {
  it('includes the large plaza bush without animating every tree or prop', () => {
    expect(isReactiveBush('plaza-south-east-tree')).toBe(true)
    expect(isReactiveBush('plaza-east-shrub')).toBe(true)
    expect(isReactiveBush('plaza-south-west-shrubs')).toBe(true)
    expect(isReactiveBush('tree-west')).toBe(false)
    expect(isReactiveBush('sign-east')).toBe(false)
  })

  it('removes yellow ground and its olive shadow while preserving teal foliage and ink alpha', () => {
    const pixels = new Uint8ClampedArray([
      195, 202, 88, 255, 100, 130, 60, 255, 50, 130, 140, 255, 10, 40, 40, 180,
    ])
    cleanBushGround(pixels)
    expect([...pixels.filter((_, i) => i % 4 === 3)]).toEqual([0, 0, 255, 180])
  })
})
