import React, { act } from 'react'
import { Platform } from 'react-native'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import SwitchableHTMLView from '../SwitchableHTMLView'
import Native from '../StylizedHTMLViewNative'
import DOM from '../HTMLContentDOM'
import { estimateReadingHtmlHeight } from '../readingHtml'

beforeEach(() => {
  Platform.OS = 'ios'
  mockEngine = 'native'
  mockPreview.mockReset().mockReturnValue(false)
})

let mockEngine: 'native' | 'dom' = 'native'
let mockTypography = { fontFamily: 'Avenir', fontSize: 19, lineHeight: 35 }
jest.mock('../useReadingTypography', () => ({ useReadingTypography: () => mockTypography }))
jest.mock('../StylizedHTMLViewNative', () => ({ __esModule: true, default: 'NativeReader' }))
jest.mock('../HTMLContentDOM', () => ({ __esModule: true, default: 'DOMReader' }))
jest.mock('react-native', () => ({ View: 'View', Platform: { OS: 'ios' } }))
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
}))
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
  const render = () => (
    <SwitchableHTMLView value={html} engine={mockEngine} onLinkClicked={onLink} />
  )
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
  expect(dom.props.dom.containerStyle).toMatchObject({
    height: estimateReadingHtmlHeight(html, mockTypography, 360),
    flex: 0,
  })
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

it.each(['native', 'dom'] as const)(
  'always uses direct DOM on web when the code override is %s',
  preference => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    Platform.OS = 'web'
    mockEngine = preference
    let view!: ReactTestRenderer
    act(() => {
      view = create(<SwitchableHTMLView value="<p>Lecture</p>" engine={mockEngine} />)
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

it('opens Bible previews first and preserves the original action for the external button', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mockPreview.mockReturnValue(true)
  const onLink = jest.fn()
  let view!: ReactTestRenderer
  act(() => {
    view = create(
      <SwitchableHTMLView
        value='<a href="bible://John.3.16">Jean 3:16</a>'
        onLinkClicked={onLink}
      />
    )
  })
  const payload = { href: 'bible://John.3.16', content: 'Jean 3:16', type: '' }
  act(() => view.root.findByType(Native).props.onLinkClicked(payload))
  expect(onLink).not.toHaveBeenCalled()
  const [target, open] = mockPreview.mock.calls[0] as unknown as [unknown, () => void]
  expect(target).toEqual(payload)
  act(() => open())
  expect(onLink).toHaveBeenCalledTimes(1)
  expect(onLink).toHaveBeenCalledWith(payload)
  act(() => view.unmount())
})

const mockPreview = jest.fn(() => false)
jest.mock('~features/bibleReferencePreview/state', () => ({
  useReferencePreview: () => mockPreview,
}))

const opacityOf = (view: ReactTestRenderer) =>
  (view.root.findByType('AnimatedView' as never).props.style as { opacity: number }).opacity

it('uses the DOM reader for selectable text on iOS only', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let view!: ReactTestRenderer
  act(() => {
    view = create(<SwitchableHTMLView value="<p>Lecture</p>" selectable />)
  })
  expect(view.root.findAllByType(Native)).toHaveLength(0)
  expect(view.root.findByType(DOM).props.html).toBe('<p>Lecture</p>')
  Platform.OS = 'android'
  act(() => view.update(<SwitchableHTMLView value="<p>Lecture</p>" selectable />))
  expect(view.root.findAllByType(DOM)).toHaveLength(0)
  expect(view.root.findByType(Native).props.html).toBe('<p>Lecture</p>')
  act(() => view.unmount())
})

it('fades the DOM reader in once its first height is measured', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let view!: ReactTestRenderer
  act(() => {
    view = create(<SwitchableHTMLView value="<p>Lecture</p>" engine="dom" />)
  })
  expect(opacityOf(view)).toBe(0)
  await act(async () => {
    await view.root.findByType(DOM).props.onSizeChange(0)
  })
  expect(opacityOf(view)).toBe(0)
  await act(async () => {
    await view.root.findByType(DOM).props.onSizeChange(240)
  })
  expect(opacityOf(view)).toBe(1)
  expect(view.root.findByType(DOM).props.dom.containerStyle.height).toBe(240)
  act(() => view.unmount())
})

it('reveals the DOM reader even if it never reports a height', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.useFakeTimers()
  let view!: ReactTestRenderer
  act(() => {
    view = create(<SwitchableHTMLView value="<p>Lecture</p>" engine="dom" />)
  })
  expect(opacityOf(view)).toBe(0)
  act(() => jest.advanceTimersByTime(2000))
  expect(opacityOf(view)).toBe(1)
  act(() => view.unmount())
  jest.useRealTimers()
})
