import React from 'react'
import { act, create, ReactTestRenderer } from 'react-test-renderer'
import PlanProgressCircle from '../PlanProgressCircle.web'

jest.mock('react-native', () => ({
  StyleSheet: { absoluteFill: { position: 'absolute' } },
  View: 'View',
}))

jest.mock('react-native-svg', () => ({
  __esModule: true,
  Circle: 'Circle',
  default: 'Svg',
}))

describe('PlanProgressCircle web', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('renders a browser-safe SVG arc without transform-origin', () => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true

    act(() => {
      renderer = create(
        <PlanProgressCircle
          size={40}
          progress={0.25}
          color="#123456"
          unfilledColor="#abcdef"
          thickness={2}
        >
          <span>Plan</span>
        </PlanProgressCircle>
      )
    })

    const serialized = JSON.stringify(renderer!.toJSON())
    expect(serialized).toContain('#123456')
    expect(serialized).toContain('#abcdef')
    expect(serialized).toContain('Plan')
    expect(serialized).not.toContain('transform-origin')
  })
})
