import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'
import { getLangIsFr } from '~i18n'

export const firebaseDb = firestore()
export const storageRef = storage().ref()
export const increment = firestore.FieldValue.increment(1)

storage().setMaxOperationRetryTime(2000)
storage().setMaxUploadRetryTime(2000)
storage().setMaxDownloadRetryTime(2000)

export const CDN_URL = 'https://assets.bible-strong.app/'
export const getStaticUrl = (path: string) => `${CDN_URL}${path}`

export const databasesRef = {
  MHY: getStaticUrl('databases/commentaires-mhy.sqlite'),
  TRESOR: getStaticUrl('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: getStaticUrl('databases/dictionnaire.sqlite'),
  INTERLINEAIRE: getStaticUrl('databases/interlineaire.sqlite'),
  NAVE: getStaticUrl('databases/nave-fr.sqlite'),
  STRONG: getStaticUrl('databases/strong.sqlite'),
  TIMELINE: getStaticUrl('databases/bible-timeline-events.json'),
  SEARCH: getStaticUrl('databases/idx-light.json'),
}

export const databasesEnRef = {
  MHY: getStaticUrl('databases/en/commentaires-mhy.sqlite'),
  TRESOR: getStaticUrl('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: getStaticUrl('databases/en/dictionnaire.sqlite'),
  INTERLINEAIRE: getStaticUrl('databases/en/interlineaire.sqlite'),
  NAVE: getStaticUrl('databases/en/nave.sqlite'),
  STRONG: getStaticUrl('databases/en/strong.sqlite'),
  TIMELINE: getStaticUrl('databases/en/bible-timeline-events.json'),
  SEARCH: getStaticUrl('databases/en/idx-light.json'),
}

interface DatabasesRef {
  [DATABASEID: string]: string
  MHY: string
  TRESOR: string
  DICTIONNAIRE: string
  INTERLINEAIRE: string
  NAVE: string
  STRONG: string
  TIMELINE: string
  SEARCH: string
}

export const getDatabasesRef = (): DatabasesRef => {
  if (getLangIsFr()) {
    return databasesRef
  }

  return databasesEnRef
}

export const biblesRef: {
  [version: string]: string
} = {
  LSG: getStaticUrl('bibles/bible-lsg.json'),
  DBY: getStaticUrl('bibles/bible-dby.json'),
  OST: getStaticUrl('bibles/bible-ost.json'),
  BDS: getStaticUrl('bibles/bible-bds.json'),
  CHU: getStaticUrl('bibles/bible-chu.json'),
  FMAR: getStaticUrl('bibles/bible-fmar.json'),
  FRC97: getStaticUrl('bibles/bible-frc97.json'),
  NBS: getStaticUrl('bibles/bible-nbs.json'),
  NEG79: getStaticUrl('bibles/bible-neg79.json'),
  NVS78P: getStaticUrl('bibles/bible-nvs78p.json'),
  S21: getStaticUrl('bibles/bible-s21.json'),
  KJF: getStaticUrl('bibles/bible-kjf.json'),
  KJV: getStaticUrl('bibles/bible-kjv.json'),
  NKJV: getStaticUrl('bibles/bible-nkjv.json'),
  ESV: getStaticUrl('bibles/bible-esv.json'),
  NIV: getStaticUrl('bibles/bible-niv.json'),
  POV: getStaticUrl('bibles/bible-pov.json'),
  BHS: getStaticUrl('bibles/bible-hebrew.json'),
  SBLGNT: getStaticUrl('bibles/bible-greek.json'),
  NFC: getStaticUrl('bibles/bible-nfc.json'),
  PDV2017: getStaticUrl('bibles/bible-pdv2017.json'),
  BFC: getStaticUrl('bibles/bible-bfc.json'),
  BCC1923: getStaticUrl('bibles/bible-bcc1923.json'),
  // JER: getStaticUrl('bibles/bible-jer.json'),
  LXX: getStaticUrl('bibles/bible-lxx.json'),
  TR1624: getStaticUrl('bibles/bible-TR1624.json'),
  TR1894: getStaticUrl('bibles/bible-TR1894.json'),
  AMP: getStaticUrl('bibles/bible-amp.json'),
  DEL: getStaticUrl('bibles/bible-del.json'),
  NASB2020: getStaticUrl('bibles/bible-nasb2020.json'),
  EASY: getStaticUrl('bibles/bible-easy.json'),
  TLV: getStaticUrl('bibles/bible-tlv.json'),
  NET: getStaticUrl('bibles/bible-net.json'),
  GW: getStaticUrl('bibles/bible-gw.json'),
  CSB: getStaticUrl('bibles/bible-csb.json'),
  NLT: getStaticUrl('bibles/bible-nlt.json'),
}
