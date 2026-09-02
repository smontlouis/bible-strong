export default {
  projectId: 'bible-strong-app',
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail:
    'firebase-adminsdk-9xlwt@bible-strong-app.iam.gserviceaccount.com',
}
