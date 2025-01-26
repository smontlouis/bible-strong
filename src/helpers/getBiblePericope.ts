import { getLangIsFr } from '~i18n'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { VersionCode } from 'src/state/tabs'
import { Pericope } from '~common/types'

const PericopeBDS = require('../assets/bible_versions/bible-bds-pericope.txt')
const PericopeFMAR = require('../assets/bible_versions/bible-fmar-pericope.txt')
const PericopeFRC97 = require('../assets/bible_versions/bible-frc97-pericope.txt')
const PericopeLSG = require('../assets/bible_versions/bible-lsg-1910-pericope.txt')
const PericopeNBS = require('../assets/bible_versions/bible-nbs-pericope.txt')
const PericopeCHU = require('../assets/bible_versions/bible-chu-pericope.txt')
const PericopeNEG79 = require('../assets/bible_versions/bible-neg79-pericope.txt')
const PericopeNVS78P = require('../assets/bible_versions/bible-nvs78p-pericope.txt')
const PericopeS21 = require('../assets/bible_versions/bible-s21-pericope.txt')
const PericopeESV = require('../assets/bible_versions/bible-esv-pericope.txt')
const PericopeNJKV = require('../assets/bible_versions/bible-nkjv-pericope.txt')

const getAsyncRequire = (version: VersionCode) => {
  switch (version) {
    case 'BDS': {
      return PericopeBDS
    }
    case 'FMAR': {
      return PericopeFMAR
    }
    case 'NFC':
    case 'FRC97': {
      return PericopeFRC97
    }
    case 'CHU': {
      return PericopeCHU
    }
    case 'LSG': {
      return PericopeLSG
    }
    case 'NBS': {
      return PericopeNBS
    }
    case 'NEG79': {
      return PericopeNEG79
    }
    case 'NVS78P': {
      return PericopeNVS78P
    }
    case 'S21': {
      return PericopeS21
    }
    case 'ESV': {
      return PericopeESV
    }
    case 'NKJV': {
      return PericopeNJKV
    }
    default: {
      return getLangIsFr() ? PericopeLSG : PericopeESV
    }
  }
}
const getBiblePericope = async (version: VersionCode) => {
  const [{ localUri }] = await Asset.loadAsync(getAsyncRequire(version))
  const json = JSON.parse(await FileSystem.readAsStringAsync(localUri || ''))
  return json as Pericope
}

export default getBiblePericope
