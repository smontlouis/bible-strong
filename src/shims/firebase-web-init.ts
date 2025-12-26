// Firebase Web SDK initialization
import { initializeApp, getApps, getApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: 'AIzaSyD4xDXoaA-TFepG-dzCO7mkY0MoIPL2ym4',
  authDomain: 'bible-strong-app.firebaseapp.com',
  databaseURL: 'https://bible-strong-app.firebaseio.com',
  projectId: 'bible-strong-app',
  storageBucket: 'bible-strong-app.appspot.com',
  messagingSenderId: '204116128917',
  appId: '1:204116128917:web:6ec6a6562ad7957402579c',
  measurementId: 'G-JGJGH2BDW8',
}

export const getFirebaseApp = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig)
  }
  return getApp()
}

// Initialize on import
export const firebaseApp = getFirebaseApp()
