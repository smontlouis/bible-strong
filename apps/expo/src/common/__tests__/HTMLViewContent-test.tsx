import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import HTMLViewContent from '../HTMLViewContent'
import HTMLContentDOM from '../HTMLContentDOM'

jest.mock('../useReadingTypography', () => ({
  useReadingTypography: () => ({ fontFamily: 'Avenir', fontSize: 19, lineHeight: 35 }),
}))

jest.mock('../HTMLContentDOM', () => ({ __esModule: true, default: 'HTMLContentDOM' }))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }))

it('starts with a visible native viewport and applies growing and shrinking DOM measurements', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(<HTMLViewContent html="<p>Aaron</p>" onLinkClicked={() => undefined} />)
  })
  const dom = () => renderer.root.findByType(HTMLContentDOM)
  expect(dom().props.dom.matchContents).toBeUndefined()
  expect(dom().props.dom.containerStyle).toMatchObject({ height: 200, flex: 0 })
  for (const height of [1400, 320]) {
    await act(async () => {
      await dom().props.onSizeChange(height)
    })
    expect(dom().props.dom.containerStyle.height).toBe(height)
  }
  await act(async () => {
    await dom().props.onSizeChange(0)
  })
  expect(dom().props.dom.containerStyle.height).toBe(320)
  act(() => renderer.unmount())
})
