import {
  coverRect,
  cssFilterMatrix,
  cssLinearEnds,
  cssRepeatingEnds,
  cssStops,
  farthestCorner,
  foilStops,
  repeatingPositions,
} from '../cardGeometry'

const close = (values: number[], expected: number[]) =>
  values.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 5))

describe('card geometry', () => {
  it('runs a CSS angle the way CSS does', () => {
    // 180deg goes down, 90deg goes right, through the middle of the box.
    const down = cssLinearEnds(180, 0, 0, 100, 200)
    close([down.start.x, down.start.y, down.end.x, down.end.y], [50, 0, 50, 200])
    const right = cssLinearEnds(90, 0, 0, 100, 200)
    close([right.start.x, right.start.y, right.end.x, right.end.y], [0, 100, 100, 100])
  })

  it('pulls backward stops forward, as a browser does', () => {
    expect(cssStops([0, -0.2, 0.5, 1.3, 1])).toEqual([0, 0, 0.5, 1, 1])
    expect(foilStops(10)).toEqual([0, 0, 0.1, 0.36, 1])
  })

  it('repeats a gradient between its first and last stop', () => {
    const ends = cssRepeatingEnds(90, 0, 0, 200, 50, 0.06, 0.42)
    close([ends.start.x, ends.end.x], [12, 84])
    expect(repeatingPositions([6, 9, 15, 42])).toEqual([0, 3 / 36, 9 / 36, 1])
  })

  it('measures a farthest-corner circle', () => {
    expect(farthestCorner(0, 0, 3, 4)).toBe(5)
    expect(farthestCorner(3, 4, 3, 4)).toBe(5)
  })

  it('covers a box and places the picture like object-position', () => {
    expect(coverRect(768, 1152, { x: 0, y: 0, width: 100, height: 104 }, 0.5, 0.28)).toEqual({
      x: 0,
      y: (104 - 150) * 0.28,
      width: 100,
      height: 150,
    })
  })

  it('composes CSS filters in their order', () => {
    const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
    close(cssFilterMatrix({}), identity)
    // brightness(0.5) then contrast(2): white (1) becomes 0.5, then 0.5 stays 0.5.
    const matrix = cssFilterMatrix({ brightness: 0.5, contrast: 2 })
    expect(matrix[0] * 1 + matrix[4]).toBeCloseTo(0.5, 5)
    // saturate(0) gives the same grey on every channel.
    const grey = cssFilterMatrix({ saturate: 0 })
    close(grey.slice(0, 3), grey.slice(5, 8))
  })
})
