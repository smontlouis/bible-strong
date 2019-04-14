export default function loadBible (bible) {
  return new Promise((resolve, reject) => {
    try {
      switch (bible) {
        case 'DBY': {
          const DarbyBible = require('~assets/bible_versions/bible-darby.json')
          resolve(DarbyBible)
          break
        }
        case 'OST': {
          const OSTBible = require('~assets/bible_versions/bible-ostervald.json')
          resolve(OSTBible)
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
