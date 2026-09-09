import React, { act } from 'react'
import { Platform } from 'react-native'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import SwitchableHTMLView from '../SwitchableHTMLView'
import Native from '../StylizedHTMLViewNative'
import DOM from '../HTMLContentDOM'

beforeEach(() => {
  Platform.OS = 'ios'
  mockEngine = 'native'
})

let mockEngine = 'native'
let mockTypography = { fontFamily: 'Avenir', fontSize: 19, lineHeight: 35 }
jest.mock('jotai/react', () => ({ useAtomValue: () => mockEngine }))
jest.mock('~state/readingHtmlEngine', () => ({ readingHtmlEngineAtom: {} }))
jest.mock('../useReadingTypography', () => ({ useReadingTypography: () => mockTypography }))
jest.mock('../StylizedHTMLViewNative', () => ({ __esModule: true, default: 'NativeReader' }))
jest.mock('../HTMLContentDOM', () => ({ __esModule: true, default: 'DOMReader' }))
jest.mock('react-native', () => ({ View: 'View', Platform: { OS: 'ios' } }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { reverse: '#fff', default: '#111', primary: '#5890ff', quart: '#c00' },
  }),
}))

it('switches engines without changing content or link payload and follows Bible typography', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const onLink = jest.fn()
  const html = '<p><a href="Aaron" class="dictionary">Aaron</a></p>'
  let view!: ReactTestRenderer
  const render = () => <SwitchableHTMLView value={html} onLinkClicked={onLink} />
  act(() => {
    view = create(render())
  })
  expect(view.root.findByType(Native).props.typography).toEqual(mockTypography)
  const payload = { href: 'Aaron', content: 'Aaron', type: 'dictionary' }
  act(() => view.root.findByType(Native).props.onLinkClicked(payload))
  mockEngine = 'dom'
  mockTypography = { fontFamily: 'Literata Book', fontSize: 22.8, lineHeight: 54 }
  act(() => view.update(render()))
  const dom = view.root.findByType(DOM)
  expect(dom.props.html).toBe(html)
  expect(dom.props.typography).toEqual(mockTypography)
  expect(dom.props.dom.containerStyle).toMatchObject({ height: 200, flex: 0 })
  for (const height of [1400, 320]) {
    await act(async () => {
      await view.root.findByType(DOM).props.onSizeChange(height)
    })
    expect(view.root.findByType(DOM).props.dom.containerStyle.height).toBe(height)
  }
  await act(async () => {
    await view.root.findByType(DOM).props.onSizeChange(0)
  })
  expect(view.root.findByType(DOM).props.dom.containerStyle.height).toBe(320)
  await act(async () => {
    await dom.props.onLinkClicked(payload)
  })
  expect(onLink.mock.calls).toEqual([[payload], [payload]])
  act(() => view.update(<SwitchableHTMLView value={html} engine="native" />))
  expect(view.root.findAllByType(DOM)).toHaveLength(0)
  expect(view.root.findByType(Native).props.html).toBe(html)
  act(() => view.unmount())
})

it.each(['native', 'dom'])(
  'always uses direct DOM on web when the mobile preference is %s',
  preference => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    Platform.OS = 'web'
    mockEngine = preference
    let view!: ReactTestRenderer
    act(() => {
      view = create(<SwitchableHTMLView value="<p>Lecture</p>" />)
    })
    expect(view.root.findAllByType(Native)).toHaveLength(0)
    expect(view.root.findByType(DOM).props.html).toBe('<p>Lecture</p>')
    act(() => {
      view.update(<SwitchableHTMLView value="<p>Lecture</p>" engine="native" />)
    })
    expect(view.root.findAllByType(Native)).toHaveLength(0)
    expect(view.root.findByType(DOM).props.html).toBe('<p>Lecture</p>')
    act(() => view.unmount())
  }
)
