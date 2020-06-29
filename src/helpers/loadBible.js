import * as FileSystem from 'expo-file-system'
import bibleMemoize from '~helpers/bibleStupidMemoize'
import { timeout } from '~helpers/timeout'

export default function loadBible(bible, position) {
  return new Promise(async (resolve, reject) => {
    try {
      switch (bible) {
        case 'LSGS':
        case 'INT':
        case 'LSG': {
          if (bibleMemoize[bible]) {
            return resolve(bibleMemoize[bible])
          }

          const LSGBible = require('~assets/bible_versions/bible-lsg-1910.json')
          resolve(LSGBible)
          break
        }
        case 'KJV': {
          if (bibleMemoize[bible]) {
            return resolve(bibleMemoize[bible])
          }

          const LSGBible = require('~assets/bible_versions/bible-kjv.json')
          resolve(LSGBible)
          break
        }
        default: {
          if (bibleMemoize[bible]) {
            return resolve(bibleMemoize[bible])
          }

          const path = `${FileSystem.documentDirectory}bible-${bible}.json`
          const file = await FileSystem.getInfoAsync(path)
          const data = await FileSystem.readAsStringAsync(file.uri)

          if (position) {
            await timeout(500 * position + 1)
          }
          bibleMemoize[bible] = JSON.parse(data)
          resolve(bibleMemoize[bible])

          break
        }
      }
    } catch (e) {
      console.log(e)
      reject('Erreur', e)
    }
  })
}
