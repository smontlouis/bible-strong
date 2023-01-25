import { atomWithStorage as aws, createJSONStorage } from 'jotai/utils'
import FilesystemStorage from 'redux-persist-filesystem-storage'
import { PrimitiveAtom } from 'jotai'

const defaultStorage = {
  ...createJSONStorage(() => FilesystemStorage),
  // Adding delay init true to avoid rehydration diff
  delayInit: true,
}
const atomWithAsyncStorage = <Value>(key: string, initialValue: Value) =>
  (aws(key, initialValue, defaultStorage) as unknown) as PrimitiveAtom<Value>

export default atomWithAsyncStorage
