import { getPlanResumeDay } from '../planProgress'

it('resumes at the first hole rather than the last completed day', () => {
  const readings = Array.from({ length: 8 }, (_, i) => ({ id: String(i + 1) }))
  expect(getPlanResumeDay(readings, { 1: 'Completed', 2: 'Completed', 3: 'Completed', 5: 'Completed', 7: 'Completed' })).toBe(4)
})
it('uses the same rule for computed readings and stays within completed plans', () => {
  expect(getPlanResumeDay([{ id: '1', status: 'Completed' }, { id: '2' }, { id: '3', status: 'Completed' }])).toBe(2)
  expect(getPlanResumeDay([{ id: '1', status: 'Completed' }])).toBe(1)
})
