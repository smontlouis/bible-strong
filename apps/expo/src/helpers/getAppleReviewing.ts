import { getRemoteConfig, getValue } from '@react-native-firebase/remote-config'

export const getAppleReviewing = () => getValue(getRemoteConfig(), 'apple_reviewing').asBoolean()
