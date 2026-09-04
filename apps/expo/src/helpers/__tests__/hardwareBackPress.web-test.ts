import { BackHandler } from 'react-native'

import { subscribeToHardwareBackPress } from '../hardwareBackPress.web'

jest.mock('react-native', () => ({
  BackHandler: {
    addEventListener: jest.fn(() => {
      throw new Error('BackHandler must not be subscribed on web')
    }),
  },
}))

describe('subscribeToHardwareBackPress on web', () => {
  it('returns a cleanup without touching the native BackHandler', () => {
    const cleanup = subscribeToHardwareBackPress(() => true)

    expect(cleanup).toEqual(expect.any(Function))
    expect(BackHandler.addEventListener).not.toHaveBeenCalled()
    expect(cleanup()).toBeUndefined()
  })
})
