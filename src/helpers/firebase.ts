import {
  getFirestore,
  increment as firestoreIncrement,
  deleteField as firestoreDeleteField,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from '@react-native-firebase/firestore'
import { getStorage, ref } from '@react-native-firebase/storage'
import { getLangIsFr } from '~i18n'
import { ResourceLanguage, DatabaseId, isSharedDB } from '~helpers/databaseTypes'

// Firebase instances (modular API)
export const firebaseDb = getFirestore()
export const storageRef = ref(getStorage())
export const increment = firestoreIncrement(1)

// Re-export modular Firestore functions for use in other files
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  firestoreDeleteField as deleteField,
  firestoreIncrement,
}

export const CDN_URL = 'https://assets.bible-strong.app/'
export const cdnUrl = (path: string) => `${CDN_URL}${path}`

// French database URLs
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

// English database URLs
export const databasesEnRef = {
  MHY: cdnUrl('databases/en/commentaires-mhy.sqlite'),
  TRESOR: cdnUrl('databases/commentaires-tresor.sqlite'), // Shared across languages
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

// Get database URL for a specific database and language
export const getDatabaseUrl = (dbId: DatabaseId, lang: ResourceLanguage): string => {
  // Shared databases always use the same URL
  if (isSharedDB(dbId)) {
    return databasesRef[dbId]
  }

  if (lang === 'fr') {
    return databasesRef[dbId]
  }

  return databasesEnRef[dbId]
}

// Legacy function for backward compatibility
export const getDatabasesRef = (): DatabasesRef => {
  if (getLangIsFr()) {
    return databasesRef
  }

  return databasesEnRef
}

// Get all database URLs for a specific language
export const getDatabasesRefForLang = (lang: ResourceLanguage): DatabasesRef => {
  if (lang === 'fr') {
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
