import { getLanguage } from '~i18n'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { VersionCode } from 'src/state/tabs'
import { Pericope } from '~common/types'
import * as Sentry from '@sentry/react-native'

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

// In-memory cache for pericope data - survives Android cache cleanup
const pericopeCache: Map<string, Pericope> = new Map()

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
      return getLanguage() === 'fr' ? PericopeLSG : PericopeESV
    }
  }
}

const getBiblePericope = async (version: VersionCode): Promise<Pericope> => {
  // 1. Check in-memory cache first
  const cached = pericopeCache.get(version)
  if (cached) {
    return cached
  }

  try {
    const moduleId = getAsyncRequire(version)

    // 2. Load the asset
    const [asset] = await Asset.loadAsync(moduleId)

    // 3. Check that the file exists before reading
    if (asset.localUri) {
      const fileInfo = await FileSystem.getInfoAsync(asset.localUri)

      if (fileInfo.exists) {
        // File exists, read it
        const content = await FileSystem.readAsStringAsync(asset.localUri)
        const pericope = JSON.parse(content) as Pericope
        pericopeCache.set(version, pericope)
        return pericope
      }
    }

    // 4. File doesn't exist - force re-download
    console.log(`[Pericope] Cache miss for ${version}, forcing re-download`)
    const freshAsset = Asset.fromModule(moduleId)
    await freshAsset.downloadAsync()

    if (freshAsset.localUri) {
      const fileInfo = await FileSystem.getInfoAsync(freshAsset.localUri)
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(freshAsset.localUri)
        const pericope = JSON.parse(content) as Pericope
        pericopeCache.set(version, pericope)
        return pericope
      }
    }

    // 5. Total failure - log and return empty
    console.warn(`[Pericope] Failed to load pericope for ${version}`)
    Sentry.addBreadcrumb({
      category: 'pericope',
      message: `Failed to load pericope for ${version}`,
      level: 'warning',
    })
    return {}
  } catch (error) {
    console.error(`[Pericope] Error loading pericope for ${version}:`, error)
    Sentry.captureException(error)
    return {}
  }
}

export default getBiblePericope
