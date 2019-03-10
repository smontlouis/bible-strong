const DarbyBible = require('~assets/bible_versions/bible-darby.json')
const OSTBible = require('~assets/bible_versions/bible-ostervald.json')
const LSGBible = require('~assets/bible_versions/bible-lsg-1910.json')

export default function loadBible (bible) {
  return new Promise((resolve, reject) => {
    try {
      switch (bible) {
        case 'DBY': {
          resolve(DarbyBible)
          break
        }
        case 'OST': {
          resolve(OSTBible)
          break
        }
        case 'LSG': {
          resolve(LSGBible)
          break
        }
        default: {
          resolve(DarbyBible)
        }
      }
    } catch (e) {
      reject('Erreur', e)
    }
  })
}
