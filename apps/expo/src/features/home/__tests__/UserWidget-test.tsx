import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import UserWidget from '../UserWidget'
import { runAfterInteractions } from '~helpers/runAfterInteractions'

jest.mock('@expo/vector-icons', () => ({ Feather: 'Feather' }))
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  View: 'View',
}))
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }))
jest.mock('react-native-reanimated-carousel', () => {
  const { createElement, Fragment } = jest.requireActual('react')
  return {
    Carousel: ({
      data,
      renderItem,
      ...props
    }: {
      data: number[]
      renderItem: (info: { item: number; index: number }) => React.ReactNode
    }) =>
      createElement(
        'Carousel',
        props,
        data.map((item, index) =>
          createElement(Fragment, { key: item }, renderItem({ item, index }))
        )
      ),
  }
})
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  AnimatedBox: 'AnimatedBox',
}))
jest.mock('~common/ui/Button', () => 'Button')
jest.mock('~common/ui/Paragraph', () => 'Paragraph')
jest.mock('~common/ui/classNames', () => ({ twMerge: (...names: string[]) => names.join(' ') }))
jest.mock('~helpers/runAfterInteractions', () => ({ runAfterInteractions: jest.fn() }))
jest.mock('~helpers/useLogin', () => () => ({ isLogged: true }))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../OfflineNotice', () => 'OfflineNotice')
jest.mock('../VerseOfTheDay', () => 'VerseOfTheDay')

let renderer: ReactTestRenderer

const flatten = (node: { props: { style?: unknown } }) => node.props.style as { height?: number }
const shell = () =>
  renderer.root.find(node => String(node.type) === 'AnimatedBox' && !!node.props.onLayout)
const carousel = () => renderer.root.find(node => String(node.type) === 'Carousel')
const card = (addDay: number) =>
  renderer.root.find(node => String(node.type) === 'VerseOfTheDay' && node.props.addDay === addDay)

const renderWidget = () => {
  act(() => {
    renderer = create(<UserWidget />)
  })
  act(() => shell().props.onLayout({ nativeEvent: { layout: { width: 390 } } }))
}

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => {
  act(() => renderer.unmount())
})

describe('home carousel height', () => {
  it('lets today’s card set the height until the carousel mounts', () => {
    jest.mocked(runAfterInteractions).mockReturnValue({ cancel: jest.fn() } as never)
    renderWidget()
    expect(shell().props.style).toEqual({ minHeight: 280 })
    expect(card(0).props.style).toBeUndefined()
  })

  it('gives every card the height of the day shown, and never less than 280', () => {
    jest.mocked(runAfterInteractions).mockImplementation(task => {
      task()
      return { cancel: jest.fn() } as never
    })
    renderWidget()
    expect(flatten(shell()).height).toBe(280)

    act(() => card(0).props.onContentHeight(360))
    act(() => card(-1).props.onContentHeight(240))
    expect(flatten(shell()).height).toBe(360)
    expect(carousel().props.style.height).toBe(360)
    expect(flatten(card(-1).parent!).height).toBe(360)

    act(() => carousel().props.onSnapToItem(3))
    expect(flatten(shell()).height).toBe(280)
    expect(carousel().props.style.height).toBe(280)
  })
})
