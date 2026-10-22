import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import SessionExpiredNotice from '../SessionExpiredNotice'

let mockIsSessionLost = true
let mockIsConnected = true

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ isSessionLost: mockIsSessionLost }),
}))
jest.mock('~helpers/useConnection', () => ({ __esModule: true, default: () => mockIsConnected }))
jest.mock('~common/ui/classNames', () => ({
  twMerge: (...classNames: (string | undefined)[]) => classNames.filter(Boolean).join(' '),
}))
jest.mock('~common/ui/Box', () => {
  const { createElement } = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => createElement('Box', props) }
})
jest.mock('~common/ui/Card', () => {
  const { createElement } = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => createElement('Card', props) }
})
jest.mock('~common/ui/IconTile', () => {
  const { createElement } = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => createElement('IconTile', props) }
})
jest.mock('~common/ui/Text', () => {
  const { createElement } = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => createElement('Text', props) }
})
jest.mock('~common/ui/Button', () => {
  const { createElement } = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => createElement('Button', props) }
})
jest.mock('~common/ui/Icon', () => {
  const { createElement } = jest.requireActual('react')
  return { FeatherIcon: (props: object) => createElement('FeatherIcon', props) }
})

describe('SessionExpiredNotice', () => {
  let view: ReactTestRenderer | undefined

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    mockIsSessionLost = true
    mockIsConnected = true
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => view?.unmount())
    view = undefined
    jest.restoreAllMocks()
  })

  const render = () => {
    act(() => {
      view = create(<SessionExpiredNotice />)
    })
    return view!
  }
  const texts = (renderer: ReactTestRenderer) =>
    renderer.root.findAllByType('Text' as never).map(node => node.props.children)

  it('invites the reader to sign in again', () => {
    const renderer = render()

    expect(texts(renderer)).toEqual(['auth.sessionExpired.title', 'auth.sessionExpired.message'])
    const button = renderer.root.findByType('Button' as never)
    expect(button.props.route).toBe('Login')
    expect(button.props.children).toBe('auth.sessionExpired.signIn')
  })

  it('offline, only says the edits wait on the device', () => {
    mockIsConnected = false
    const renderer = render()

    expect(texts(renderer)).toEqual([
      'auth.sessionExpired.title',
      'auth.sessionExpired.offlineMessage',
    ])
    expect(renderer.root.findAllByType('Button' as never)).toEqual([])
  })

  it('shows nothing while the session holds', () => {
    mockIsSessionLost = false

    expect(render().toJSON()).toBeNull()
  })
})
