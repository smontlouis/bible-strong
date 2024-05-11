import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'
import { getLangIsFr } from '~i18n'

export const firebaseDb = firestore()
export const storageRef = storage().ref()
export const increment = firestore.FieldValue.increment(1)

storage().setMaxOperationRetryTime(2000)
storage().setMaxUploadRetryTime(2000)
storage().setMaxDownloadRetryTime(2000)

export const cdnUrl = (path: string) =>
  `${process.env.EXPO_PUBLIC_CDN_URL}${path}`

export const databasesRef = {
  MHY: cdnUrl('databases/commentaires-mhy.sqlite'),
  TRESOR: cdnUrl('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: cdnUrl('databases/dictionnaire.sqlite'),
  INTERLINEAIRE: cdnUrl('databases/interlineaire.sqlite'),
  NAVE: cdnUrl('databases/nave-fr.sqlite'),
  STRONG: cdnUrl('databases/strong.sqlite'),
  TIMELINE: cdnUrl('databases/bible-timeline-events.json'),
  SEARCH: cdnUrl('databases/idx-light.json'),
}

export const databasesEnRef = {
  MHY: cdnUrl('databases/en/commentaires-mhy.sqlite'),
  TRESOR: cdnUrl('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: cdnUrl('databases/en/dictionnaire.sqlite'),
  INTERLINEAIRE: cdnUrl('databases/en/interlineaire.sqlite'),
  NAVE: cdnUrl('databases/en/nave.sqlite'),
  STRONG: cdnUrl('databases/en/strong.sqlite'),
  TIMELINE: cdnUrl('databases/en/bible-timeline-events.json'),
  SEARCH: cdnUrl('databases/en/idx-light.json'),
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
  LSG: cdnUrl('bibles/bible-lsg.json'),
  DBY: cdnUrl('bibles/bible-dby.json'),
  OST: cdnUrl('bibles/bible-ost.json'),
  BDS: cdnUrl('bibles/bible-bds.json'),
  CHU: cdnUrl('bibles/bible-chu.json'),
  FMAR: cdnUrl('bibles/bible-fmar.json'),
  FRC97: cdnUrl('bibles/bible-frc97.json'),
  NBS: cdnUrl('bibles/bible-nbs.json'),
  NEG79: cdnUrl('bibles/bible-neg79.json'),
  NVS78P: cdnUrl('bibles/bible-nvs78p.json'),
  S21: cdnUrl('bibles/bible-s21.json'),
  KJF: cdnUrl('bibles/bible-kjf.json'),
  KJV: cdnUrl('bibles/bible-kjv.json'),
  NKJV: cdnUrl('bibles/bible-nkjv.json'),
  ESV: cdnUrl('bibles/bible-esv.json'),
  NIV: cdnUrl('bibles/bible-niv.json'),
  POV: cdnUrl('bibles/bible-pov.json'),
  BHS: cdnUrl('bibles/bible-hebrew.json'),
  SBLGNT: cdnUrl('bibles/bible-greek.json'),
  NFC: cdnUrl('bibles/bible-nfc.json'),
  PDV2017: cdnUrl('bibles/bible-pdv2017.json'),
  BFC: cdnUrl('bibles/bible-bfc.json'),
  BCC1923: cdnUrl('bibles/bible-bcc1923.json'),
  // JER: cdnUrl('bibles/bible-jer.json'),
  LXX: cdnUrl('bibles/bible-lxx.json'),
  TR1624: cdnUrl('bibles/bible-TR1624.json'),
  TR1894: cdnUrl('bibles/bible-TR1894.json'),
  AMP: cdnUrl('bibles/bible-amp.json'),
  DEL: cdnUrl('bibles/bible-del.json'),
  NASB2020: cdnUrl('bibles/bible-nasb2020.json'),
  EASY: cdnUrl('bibles/bible-easy.json'),
  TLV: cdnUrl('bibles/bible-tlv.json'),
  NET: cdnUrl('bibles/bible-net.json'),
  GW: cdnUrl('bibles/bible-gw.json'),
  CSB: cdnUrl('bibles/bible-csb.json'),
  NLT: cdnUrl('bibles/bible-nlt.json'),
}
