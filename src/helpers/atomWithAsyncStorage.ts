import { atomWithStorage as aws, createJSONStorage } from 'jotai/utils'
import fileSystemStorage from './fileSystemStorage'

const atomWithAsyncStorage = <Value>(key: string, initialValue: Value) => {
  const defaultStorage = createJSONStorage<Value>(() => fileSystemStorage)
  return aws<Value>(key, initialValue, defaultStorage)
}
export default atomWithAsyncStorage
