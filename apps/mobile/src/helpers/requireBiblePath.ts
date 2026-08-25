import * as FileSystem from 'expo-file-system/legacy'

export const requireBiblePath = (id: string) => `${FileSystem.documentDirectory}bible-${id}.json`
