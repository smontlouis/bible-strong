import { FileSystem } from 'expo'
import bibleMemoize from '~helpers/bibleStupidMemoize'

export default function loadBible (bible) {
  return new Promise(async (resolve, reject) => {
    try {
      switch (bible) {
        case 'DBY': {
          if (bibleMemoize['DBY']) {
            return resolve(bibleMemoize['DBY'])
          }

          const path = `${FileSystem.documentDirectory}bible-DBY.json`
          const file = await FileSystem.getInfoAsync(path)
          const data = await FileSystem.readAsStringAsync(file.uri)

          bibleMemoize['DBY'] = JSON.parse(data)
          resolve(bibleMemoize['DBY'])

          break
        }
        case 'OST': {
          if (bibleMemoize['OST']) {
            return resolve(bibleMemoize['OST'])
          }

          const path = `${FileSystem.documentDirectory}bible-OST.json`
          const file = await FileSystem.getInfoAsync(path)
          const data = await FileSystem.readAsStringAsync(file.uri)

          bibleMemoize['OST'] = JSON.parse(data)
          resolve(bibleMemoize['OST'])

          break
        }
        case 'LSG': {
          const LSGBible = require('~assets/bible_versions/bible-lsg-1910.json')
          resolve(LSGBible)
          break
        }
        default: {
          reject('Erreur')
        }
      }
    } catch (e) {
      reject('Erreur', e)
    }
  })
}
