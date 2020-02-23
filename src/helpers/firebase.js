import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'

export const firebaseDb = firestore()
export const storageRef = storage().ref()

storage().setMaxOperationRetryTime(2000)
storage().setMaxUploadRetryTime(2000)
storage().setMaxDownloadRetryTime(2000)

export const biblesRef = {
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
  INT: storageRef.child('databases/interlineaire.sqlite'),
  KJV: storageRef.child('bibles/bible-kjv.json'),
  NKJV: storageRef.child('bibles/bible-nkjv.json'),
  ESV: storageRef.child('bibles/bible-esv.json'),
  NIV: storageRef.child('bibles/bible-niv.json'),
  POV: storageRef.child('bibles/bible-pov.json'),
  BHS: storageRef.child('bibles/bible-hebrew.json'),
  SBLGNT: storageRef.child('bibles/bible-greek.json')
}

export const databasesRef = {
  MHY: storageRef.child('databases/commentaires-mhy.sqlite'),
  TRESOR: storageRef.child('databases/commentaires-tresor.sqlite'),
  DICTIONNAIRE: storageRef.child('databases/dictionnaire.sqlite'),
  INTERLINEAIRE: storageRef.child('databases/interlineaire.sqlite'),
  NAVE: storageRef.child('databases/nave-fr.sqlite'),
  STRONG: storageRef.child('databases/strong.sqlite')
}
