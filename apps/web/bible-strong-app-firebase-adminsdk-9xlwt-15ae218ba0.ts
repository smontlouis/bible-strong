import { ServiceAccount } from 'firebase-admin'

export default <ServiceAccount>{
  type: 'service_account',
  project_id: 'bible-strong-app',
  private_key_id: '15ae218ba01c3e3d1081a1bed9249a91a18b263b',
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email:
    'firebase-adminsdk-9xlwt@bible-strong-app.iam.gserviceaccount.com',
  client_id: '111747950030392122008',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url:
    'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-9xlwt%40bible-strong-app.iam.gserviceaccount.com',
}
