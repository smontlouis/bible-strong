import { initializeApp, getApps } from 'firebase-admin/app'

// Éviter double initialisation (Firebase Functions v2 peut initialiser automatiquement)
// Sans `credential`, l'Admin SDK prend le compte de service d'exécution de la fonction.
if (getApps().length === 0) {
  initializeApp({
    databaseURL: 'https://bible-strong-app.firebaseio.com',
    storageBucket: 'bible-strong-app.appspot.com',
  })
}

export { iaphub } from './iaphub'
export { exportStudyPDF, deleteStudy } from './studies'
export { createUser, deleteUser } from './users'

export { fetchOpenGraph } from './open-graph'
