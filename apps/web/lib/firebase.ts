import * as admin from 'firebase-admin'
import serviceAccount from '../bible-strong-app-firebase-adminsdk-9xlwt-15ae218ba0'

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://bible-strong-app.firebaseio.com',
  })
} catch (error: any) {
  if (!/already exists/u.test(error.message)) {
    console.error('Firebase admin initialization error', error.stack)
  }
}

export default admin
