import { getSupportDevice } from '../supportDevice'

const mockPlatform = {
  OS: 'ios',
  Version: '26.5' as string | number,
  constants: { Model: 'Pixel 9', Manufacturer: 'Google', Release: '15' },
}
const mockDevice = jest.fn()
jest.mock('react-native', () => ({
  get Platform() {
    return mockPlatform
  },
}))
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => mockDevice() }))

describe('support device information', () => {
  it('uses the native model without collecting the personalized device name', () => {
    mockDevice.mockReturnValueOnce({
      modelName: 'iPhone 17',
      modelId: 'iPhone18,3',
      manufacturer: 'Apple',
      isDevice: true,
      deviceName: 'Private name',
    })
    const result = getSupportDevice()
    expect(result).toMatchObject({ model: 'iPhone 17', modelId: 'iPhone18,3', osVersion: '26.5' })
    expect(JSON.stringify(result)).not.toContain('Private name')
  })

  it('does not crash on an older iOS binary without ExpoDevice', () => {
    mockDevice.mockReturnValueOnce(null)
    expect(getSupportDevice()).toMatchObject({ os: 'ios', osVersion: '26.5', model: undefined })
  })

  it('falls back to Android system constants and distinguishes OS version from API level', () => {
    mockPlatform.OS = 'android'
    mockPlatform.Version = 35
    mockDevice.mockReturnValueOnce(null)
    expect(getSupportDevice()).toMatchObject({
      model: 'Pixel 9',
      manufacturer: 'Google',
      osVersion: '15',
      androidApi: 35,
    })
  })
})
