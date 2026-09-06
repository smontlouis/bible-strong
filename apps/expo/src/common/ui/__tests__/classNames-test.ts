import { twMerge } from '../classNames'

it('keeps native border curves, colors, and widths independent', () => {
  expect(twMerge('border-border', 'border-continuous border-b-[1px]')).toBe(
    'border-border border-continuous border-b-[1px]'
  )
  expect(twMerge('border-continuous border-primary', 'border-circular border-border')).toBe(
    'border-circular border-border'
  )
})

it('lets caller classes replace layout and background defaults', () => {
  expect(twMerge('flex-row bg-reverse', 'flex-col bg-light-grey')).toBe('flex-col bg-light-grey')
})
