import { initializeApp } from 'firebase-admin/app'
import * as admin from 'firebase-admin'

const serviceProdAccountKey = require('../helpers/service-account.json')

initializeApp({
  credential: admin.credential.cert(serviceProdAccountKey),
  databaseURL: 'https://bible-strong-app.firebaseio.com',
  storageBucket: 'bible-strong-app.appspot.com',
})

export { grec } from './grec'
export { hebreu } from './hebreu'
export { dictionnaire } from './dictionnaire'
export { count_verses } from './count_verses'
export { iaphub } from './iaphub'
export { exportStudyPDF, deleteStudy } from './studies'
export { createUser } from './users'

// // Quick and dirty fix to get the expo-up functions working
// export { api } from './expo_updates'

export { fetchOpenGraph } from './open-graph'
