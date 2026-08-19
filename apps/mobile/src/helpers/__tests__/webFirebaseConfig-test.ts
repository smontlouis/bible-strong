import { getWebFirebaseConfig } from '../webFirebaseConfig'

describe('getWebFirebaseConfig', () => {
  it('returns a browser Firebase config when every required value is present', () => {
    expect(
      getWebFirebaseConfig({
        EXPO_PUBLIC_FIREBASE_API_KEY: 'api-key',
        EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'auth.example',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'project-id',
        EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'bucket.example',
        EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'sender-id',
        EXPO_PUBLIC_FIREBASE_APP_ID: 'app-id',
      })
    ).toEqual({
      apiKey: 'api-key',
      authDomain: 'auth.example',
      projectId: 'project-id',
      storageBucket: 'bucket.example',
      messagingSenderId: 'sender-id',
      appId: 'app-id',
    })
  })

  it('reports which required browser setting is missing', () => {
    expect(() => getWebFirebaseConfig({})).toThrow(
      'Missing Expo Web Firebase configuration: EXPO_PUBLIC_FIREBASE_API_KEY'
    )
  })
})
