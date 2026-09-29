import { requireOptionalNativeModule } from 'expo-modules-core'
import { Platform } from 'react-native'

export function getSupportDevice() {
  // Older installed binaries may not contain ExpoDevice yet. Keep contact usable after an OTA.
  const device =
    requireOptionalNativeModule<
      Pick<typeof import('expo-device'), 'modelName' | 'modelId' | 'manufacturer' | 'isDevice'>
    >('ExpoDevice')
  return {
    model: device?.modelName ?? (Platform.OS === 'android' ? Platform.constants.Model : undefined),
    modelId: device?.modelId,
    manufacturer:
      device?.manufacturer ??
      (Platform.OS === 'android' ? Platform.constants.Manufacturer : 'Apple'),
    physicalDevice: device?.isDevice,
    os: Platform.OS,
    osVersion: Platform.OS === 'android' ? Platform.constants.Release : Platform.Version,
    androidApi: Platform.OS === 'android' ? Platform.Version : undefined,
  }
}
