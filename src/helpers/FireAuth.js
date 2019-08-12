import * as firebase from 'firebase'
import * as Google from 'expo-google-app-auth'
import * as Facebook from 'expo-facebook'
import 'firebase/firestore'
import * as Segment from 'expo-analytics-segment'
import Sentry from 'sentry-expo'

import SnackBar from '~common/SnackBar'
import { firebaseDb } from '~helpers/firebaseDb'

const FireAuth = class {
  user = null
  profile = null
  onUserChange = null
  onLogout = null
  onEmailVerified = null
  onLogin = null
  onError = null

  init (onLogin, onUserChange, onLogout, onEmailVerified, onError) {
    this.onUserChange = onUserChange
    this.onLogout = onLogout
    this.onEmailVerified = onEmailVerified
    this.onLogin = onLogin
    this.onError = onError

    firebase.auth().onAuthStateChanged((user) => {
      if (user && user.isAnonymous) {
        console.log('User exists and is anonymous: ', user.uid)

        const uid = user.uid

        firebaseDb.collection('users').doc(uid).set({
          id: user.uid,
          lastSeen: Date.now()
        }, { merge: true })
        if (!__DEV__) {
          Segment.identify(uid)
        }

        return
      }

      if (user) {
        console.log('User exists: ', user)

        // Determine if user needs to verify email
        const emailVerified = !user.providerData || !user.providerData.length || user.providerData[0].providerId != 'password' || user.emailVerified

        const profile = {
          id: user.uid,
          email: user.email,
          displayName: user.providerData[0].displayName,
          photoURL: user.providerData[0].photoURL,
          provider: user.providerData[0].providerId,
          lastSeen: Date.now(),
          emailVerified: emailVerified
        }

        const userDoc = firebaseDb.collection('users').doc(user.uid)

        userDoc.update(profile)

        const unsubscribe = userDoc
          .onSnapshot((doc) => {
            unsubscribe()

            const data = doc.data()

            console.log('HEY: ', data)

            if (!this.user) {
              // Get studies - TODO: DO IT BETTER
              let studies = {}
              firebaseDb.collection('studies').where('user.id', '==', user.uid)
                .get()
                .then((querySnapshot) => {
                  querySnapshot.forEach(doc => {
                    const study = doc.data()
                    studies[study.id] = study
                  })

                  if (data.bible && studies) data.bible.studies = studies

                  this.onLogin && this.onLogin(data) // On login
                })
            } else if (data) {
              this.onUserChange && this.onUserChange(data) // On updated
            }

            this.user = user // Store user
          })

        if (!__DEV__) {
          Segment.identify(user.uid)
        }
        return
      }

      console.log('No user, need to sign in')
      this.user = null

      firebase.auth().signInAnonymously().catch((error) => {
        Sentry.captureException(error)
      })
    })
  }

  facebookLogin = () => new Promise(async (resolve, reject) => {
    try {
      const { type, token } = await Facebook.logInWithReadPermissionsAsync(
        '312719079612015',
        { permissions: ['public_profile', 'email'] }
      )

      if (type === 'success' && token) {
        // Build Firebase credential with the Facebook access token.
        const credential = firebase.auth.FacebookAuthProvider.credential(token)
        this.onCredentialSuccess(credential, resolve)
      }
    } catch (e) {
      SnackBar.show('Une erreur est survenue.', e)
      resolve(false)
    }
  })

  googleLogin = () => new Promise(async (resolve, reject) => {
    try {
      const result = await Google.logInAsync({
        androidClientId: '204116128917-95eiop5au3ftj8h87234f0ga0jpg29g1.apps.googleusercontent.com',
        iosClientId: '204116128917-q1pl4f4pt4tflfetgb905e9b4e34pu61.apps.googleusercontent.com',
        scopes: ['profile', 'email', 'openid']
      })

      if (result.type === 'success') {
        const googleUser = result

        const credential = firebase.auth.GoogleAuthProvider.credential(
          googleUser.idToken,
          googleUser.accessToken
        )

        this.onCredentialSuccess(credential, resolve)
      } else {
        SnackBar.show('Connexion annulée.')
        resolve(false)
      }
    } catch (e) {
      SnackBar.show('Une erreur est survenue.', e)
      resolve(false)
    }
  })

  onCredentialSuccess = (credential, resolve) => {
    firebase.auth().currentUser.linkWithCredential(credential).then((usercred) => {
      console.log('First connexion - Anonymous account successfully upgraded', usercred)
      SnackBar.show('Connexion réussie')
      resolve(true)
    }, (error) => {
      console.log('Error upgrading anonymous account', error)
      if (
        error.code === 'auth/credential-already-in-use' ||
        error.code === 'auth/provider-already-linked'
      ) {
        firebase
          .auth()
          .signInWithCredential(credential)
          .then(user => {
            console.log('user signed in ', user)
            SnackBar.show('Connexion réussie')
            resolve(true)
          })
      } else if (error.code === 'auth/email-already-in-use') {
        SnackBar.show('Un utilisateur existe déjà avec un autre compte. Connectez-vous !')
        resolve(true)
      } else {
        SnackBar.show('Une erreur est survenue.')
        resolve(true)
      }
    })
  }

  logout = () => {
    firebase.auth().signOut()
    // Sign-out successful.
    this.user = null
    this.onLogout && this.onLogout()
  }
}

export default new FireAuth()
