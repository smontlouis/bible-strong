import { atomWithStorage as aws, createJSONStorage } from 'jotai/utils'
import FilesystemStorage from 'redux-persist-filesystem-storage'

const defaultStorage = {
  ...createJSONStorage(() => FilesystemStorage),
  delayInit: true,
}

const atomWithAsyncStorage = <Value>(key: string, initialValue: Value) =>
  aws<Value>(key, initialValue, defaultStorage)

export default atomWithAsyncStorage
