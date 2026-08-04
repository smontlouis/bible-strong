import { isStrongOriginalUnnamed } from '../strongOriginalPresentation'

describe('strongOriginalPresentation', () => {
  it.each(['[unnamed]', ' [UNNAMED] ', ''])('identifies %p as an unnamed original', original => {
    expect(isStrongOriginalUnnamed(original)).toBe(true)
  })

  it.each(['Πέτρος', 'אָב', '[כִּי] אם'])('keeps %p as a named original', original => {
    expect(isStrongOriginalUnnamed(original)).toBe(false)
  })
})
