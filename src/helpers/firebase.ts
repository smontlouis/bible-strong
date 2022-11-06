import firestore from '@react-native-firebase/firestore'
import storage, { FirebaseStorageTypes } from '@react-native-firebase/storage'
import { getLangIsFr } from '~i18n'

export const firebaseDb = firestore()
export const storageRef = storage().ref()
export const increment = firestore.FieldValue.increment(1)

storage().setMaxOperationRetryTime(2000)
storage().setMaxUploadRetryTime(2000)
storage().setMaxDownloadRetryTime(2000)

export const databasesRef = {
  MHY: storageRef.child('databases/commentaires-mhy.sqlite'),
  TRESOR: storageRef.child('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: storageRef.child('databases/dictionnaire.sqlite'),
  INTERLINEAIRE: storageRef.child('databases/interlineaire.sqlite'),
  NAVE: storageRef.child('databases/nave-fr.sqlite'),
  STRONG: storageRef.child('databases/strong.sqlite'),
  TIMELINE: storageRef.child('databases/bible-timeline-events.json'),
  SEARCH: storageRef.child('databases/idx-light.json'),
}

export const databasesEnRef = {
  MHY: storageRef.child('databases/en/commentaires-mhy.sqlite'),
  TRESOR: storageRef.child('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: storageRef.child('databases/en/dictionnaire.sqlite'),
  INTERLINEAIRE: storageRef.child('databases/en/interlineaire.sqlite'),
  NAVE: storageRef.child('databases/en/nave.sqlite'),
  STRONG: storageRef.child('databases/en/strong.sqlite'),
  TIMELINE: storageRef.child('databases/en/bible-timeline-events.json'),
  SEARCH: storageRef.child('databases/en/idx-light.json'),
}

interface DatabasesRef {
  [DATABASEID: string]: FirebaseStorageTypes.Reference
  MHY: FirebaseStorageTypes.Reference
  TRESOR: FirebaseStorageTypes.Reference
  DICTIONNAIRE: FirebaseStorageTypes.Reference
  INTERLINEAIRE: FirebaseStorageTypes.Reference
  NAVE: FirebaseStorageTypes.Reference
  STRONG: FirebaseStorageTypes.Reference
  TIMELINE: FirebaseStorageTypes.Reference
  SEARCH: FirebaseStorageTypes.Reference
}

export const getDatabasesRef = (): DatabasesRef => {
  if (getLangIsFr()) {
    return databasesRef
  }

  return databasesEnRef
}

export const biblesRef: {
  [version: string]: FirebaseStorageTypes.Reference
} = {
  LSG: storageRef.child('bibles/bible-lsg.json'),
  DBY: storageRef.child('bibles/bible-dby.json'),
  OST: storageRef.child('bibles/bible-ost.json'),
  BDS: storageRef.child('bibles/bible-bds.json'),
  CHU: storageRef.child('bibles/bible-chu.json'),
  FMAR: storageRef.child('bibles/bible-fmar.json'),
  FRC97: storageRef.child('bibles/bible-frc97.json'),
  NBS: storageRef.child('bibles/bible-nbs.json'),
  NEG79: storageRef.child('bibles/bible-neg79.json'),
  NVS78P: storageRef.child('bibles/bible-nvs78p.json'),
  S21: storageRef.child('bibles/bible-s21.json'),
  KJF: storageRef.child('bibles/bible-kjf.json'),
  KJV: storageRef.child('bibles/bible-kjv.json'),
  NKJV: storageRef.child('bibles/bible-nkjv.json'),
  ESV: storageRef.child('bibles/bible-esv.json'),
  NIV: storageRef.child('bibles/bible-niv.json'),
  POV: storageRef.child('bibles/bible-pov.json'),
  BHS: storageRef.child('bibles/bible-hebrew.json'),
  SBLGNT: storageRef.child('bibles/bible-greek.json'),
  NFC: storageRef.child('bibles/bible-nfc.json'),
  PDV2017: storageRef.child('bibles/bible-pdv2017.json'),
  BFC: storageRef.child('bibles/bible-bfc.json'),
  BCC1923: storageRef.child('bibles/bible-bcc1923.json'),
  // JER: storageRef.child('bibles/bible-jer.json'),
  LXX: storageRef.child('bibles/bible-lxx.json'),
  TR1624: storageRef.child('bibles/bible-TR1624.json'),
  TR1894: storageRef.child('bibles/bible-TR1894.json'),
  AMP: storageRef.child('bibles/bible-amp.json'),
  DEL: storageRef.child('bibles/bible-del.json'),
  NASB2020: storageRef.child('bibles/bible-nasb2020.json'),
  EASY: storageRef.child('bibles/bible-easy.json'),
  TLV: storageRef.child('bibles/bible-tlv.json'),
  NET: storageRef.child('bibles/bible-net.json'),
  GW: storageRef.child('bibles/bible-gw.json'),
  CSB: storageRef.child('bibles/bible-csb.json'),
  NLT: storageRef.child('bibles/bible-nlt.json'),
}
