import { horizontalWheelDelta } from '../wheelDelta'
const metrics = { position: 50, extent: 200, viewport: 100, lineHeight: 20 }
const event = {
  deltaX: 0,
  deltaY: 30,
  deltaMode: 0,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
}
it('converts vertical pixels only while the band can scroll', () => {
  expect(horizontalWheelDelta(event, metrics)).toBe(30)
  expect(horizontalWheelDelta(event, { ...metrics, position: 200 })).toBe(0)
  expect(horizontalWheelDelta({ ...event, deltaY: -30 }, { ...metrics, position: 0 })).toBe(0)
  expect(horizontalWheelDelta(event, { ...metrics, position: 0, extent: 0 })).toBe(0)
})
it('clamps movement and normalizes line/page deltas', () => {
  expect(horizontalWheelDelta({ ...event, deltaY: 500 }, metrics)).toBe(150)
  expect(horizontalWheelDelta({ ...event, deltaY: -500 }, metrics)).toBe(-50)
  expect(horizontalWheelDelta({ ...event, deltaY: 2, deltaMode: 1 }, metrics)).toBe(40)
  expect(horizontalWheelDelta({ ...event, deltaY: 1, deltaMode: 2 }, metrics)).toBe(100)
})
it('preserves horizontal trackpad gestures, modifiers and zoom', () => {
  for (const override of [
    { deltaX: 10 },
    { deltaX: -1 },
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { deltaY: 0 },
  ]) {
    expect(horizontalWheelDelta({ ...event, ...override }, metrics)).toBe(0)
  }
})
