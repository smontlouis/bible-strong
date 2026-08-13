import { updateEyeDimension, scaleEye, updateEyePosition } from '../expressionEditing'
import { defaultExpression } from '../presets'

describe('Expression eye editing', () => {
  it('applies linked dimensions through one invariant-preserving operation', () => {
    const next = updateEyeDimension(defaultExpression, 'Left', 'width', 140, true)
    expect(next.widthLeft).toBe(100)
    expect(next.widthRight).toBe(100)
  })

  it('scales both eyes proportionally without exceeding eye bounds', () => {
    const next = scaleEye(defaultExpression, 'Left', 100, true)
    expect(next.heightLeft).toBe(100)
    expect(next.widthLeft).toBe(40)
    expect(next.heightRight).toBe(100)
    expect(next.widthRight).toBe(40)
  })

  it('keeps linked eye positions symmetrical as an editing rule', () => {
    const next = updateEyePosition(defaultExpression, 'Right', 'Y', 12, true)
    expect(next.positionYLeft).toBe(12)
    expect(next.positionYRight).toBe(12)
  })
})
