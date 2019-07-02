import * as FileSystem from 'expo-file-system'
import bibleMemoize from '~helpers/bibleStupidMemoize'

export default function loadBible (bible) {
  return new Promise(async (resolve, reject) => {
    try {
      switch (bible) {
        case 'BDS':
        case 'FMAR':
        case 'DBY':
        case 'FRC97':
        case 'NBS':
        case 'NEG79':
        case 'NVS78P':
        case 'S21':
        case 'OST': {
          if (bibleMemoize[bible]) {
            return resolve(bibleMemoize[bible])
          }

          const path = `${FileSystem.documentDirectory}bible-${bible}.json`
          const file = await FileSystem.getInfoAsync(path)
          const data = await FileSystem.readAsStringAsync(file.uri)

          bibleMemoize[bible] = JSON.parse(data)
          resolve(bibleMemoize[bible])

          break
        }
        case 'LSG': {
          const LSGBible = require('~assets/bible_versions/bible-lsg-1910.json')
          resolve(LSGBible)
          break
        }
        default: {
          reject('Bible non prise en charge')
        }
      }
    } catch (e) {
      reject('Erreur', e)
    }
  })
}
