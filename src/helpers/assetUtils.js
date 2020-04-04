import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { unzip } from 'react-native-zip-archive'

const RNFS = require('react-native-fs')

// eg: filepath: 'www/strong.sqlite'
export const existsAssets = async filePath => {
  if (Platform.OS === 'android') {
    return RNFS.existsAssets(filePath)
  }

  return RNFS.exists(`${RNFS.MainBundlePath}/${filePath}`)
}

export const copyAssets = async (filePath, destPath) => {
  if (Platform.OS === 'android') {
    return RNFS.copyFileAssets(filePath, destPath)
  }

  return FileSystem.copyAsync({
    from: `${RNFS.MainBundlePath}/${filePath}`,
    to: destPath,
  })
}

export const unzipAssets = async (filePath, destPath) => {
  if (Platform.OS === 'android') {
    await RNFS.copyFileAssets(filePath, `${RNFS.DocumentDirectoryPath}/tmp.zip`)
    const path = await unzip(`${RNFS.DocumentDirectoryPath}/tmp.zip`, destPath)
    await RNFS.unlink(`${RNFS.DocumentDirectoryPath}/tmp.zip`)
    console.log('unzip completed at: ', path)

    return true
  }

  console.log('filePath: ', `${RNFS.MainBundlePath}/${filePath}`)
  console.log('destPath: ', destPath)
  return unzip(`${RNFS.MainBundlePath}/${filePath}`, destPath)
}
