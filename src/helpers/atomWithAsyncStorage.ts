import AsyncStorage from '@react-native-async-storage/async-storage'
import { atomWithStorage as aws, createJSONStorage } from 'jotai/vanilla/utils'

const atomWithAsyncStorage = <Value>(key: string, initialValue: Value) => {
  const defaultStorage = {
    ...createJSONStorage<Value>(() => AsyncStorage),
    delayInit: false,
  }
  return aws<Value>(key, initialValue, defaultStorage)
}
export default atomWithAsyncStorage
