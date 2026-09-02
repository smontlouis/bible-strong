import { initializeApp, getApps } from 'firebase-admin/app'
import * as admin from 'firebase-admin'

const serviceProdAccountKey = require('../helpers/service-account.json')

// Éviter double initialisation (Firebase Functions v2 peut initialiser automatiquement)
if (getApps().length === 0) {
  initializeApp({
    credential: admin.credential.cert(serviceProdAccountKey),
    databaseURL: 'https://bible-strong-app.firebaseio.com',
    storageBucket: 'bible-strong-app.appspot.com',
  })
}

export { iaphub } from './iaphub'
export { exportStudyPDF, deleteStudy } from './studies'
export { createUser, deleteUser } from './users'

// // Quick and dirty fix to get the expo-up functions working
// export { api } from './expo_updates'

export { fetchOpenGraph } from './open-graph'
