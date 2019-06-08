import * as FileSystem from 'expo-file-system'

export const getIfVersionNeedsDownload = async (versionId) => {
  if (versionId === 'LSG') {
    return false
  }
  const path = `${FileSystem.documentDirectory}bible-${versionId}.json`
  let file = await FileSystem.getInfoAsync(path)

  // if (__DEV__) {
  //   if (file.exists) {
  //     FileSystem.deleteAsync(file.uri)
  //     file = await FileSystem.getInfoAsync(path)
  //   }
  // }

  if (!file.exists) {
    return true
  }

  return false
}

export const versions = {
  LSG: {
    id: 'LSG',
    name: 'Bible Segond 1910'
  },
  DBY: {
    id: 'DBY',
    name: 'Bible Darby'
  },
  OST: {
    id: 'OST',
    name: 'Ostervald'
  }
}
