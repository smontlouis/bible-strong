import React from 'react'
import { act, create } from 'react-test-renderer'

import ChapterButton from '../ChapterButton'

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Box = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)

  return {
    __esModule: true,
    default: Box,
    TouchableBox: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableBox', props, children),
  }
})

jest.mock('~common/ui/Icon', () => ({ IonIcon: () => null }))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('ChapterButton', () => {
  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  it.each([
    ['left', 'accessibility.previousChapter'],
    ['right', 'accessibility.nextChapter'],
  ] as const)('exposes the %s chapter control to screen readers', (direction, label) => {
    let renderer: ReturnType<typeof create>

    act(() => {
      renderer = create(
        <ChapterButton direction={direction} hasNextChapter disabled onPress={jest.fn()} />
      )
    })

    const button = renderer!.root.findByProps({ accessibilityLabel: label })
    expect(button.props.accessibilityRole).toBe('button')
    expect(button.props.accessibilityState).toEqual({ disabled: true })
  })

  it('does not expose a control when the adjacent chapter does not exist', () => {
    let renderer: ReturnType<typeof create>

    act(() => {
      renderer = create(
        <ChapterButton direction="right" hasNextChapter={false} onPress={jest.fn()} />
      )
    })

    expect(renderer!.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0)
  })
})
