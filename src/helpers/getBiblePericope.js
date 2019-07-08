const PericopeBDS = require('../assets/bible_versions/bible-bds-pericope.json')
const PericopeFMAR = require('../assets/bible_versions/bible-fmar-pericope.json')
const PericopeFRC97 = require('../assets/bible_versions/bible-frc97-pericope.json')
const PericopeLSG = require('../assets/bible_versions/bible-lsg-1910-pericope.json')
const PericopeNBS = require('../assets/bible_versions/bible-nbs-pericope.json')
const PericopeNEG79 = require('../assets/bible_versions/bible-neg79-pericope.json')
const PericopeNVS78P = require('../assets/bible_versions/bible-nvs78p-pericope.json')
const PericopeS21 = require('../assets/bible_versions/bible-s21-pericope.json')

const getBiblePericope = (version) => {
  switch (version) {
    case 'BDS': {
      return PericopeBDS
    }
    case 'FMAR': {
      return PericopeFMAR
    }
    case 'FRC97': {
      return PericopeFRC97
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
    default: {
      return PericopeLSG
    }
  }
}

export default getBiblePericope
