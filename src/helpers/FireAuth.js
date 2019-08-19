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

  init(onLogin, onUserChange, onLogout, onEmailVerified, onError) {
    this.onUserChange = onUserChange
    this.onLogout = onLogout
    this.onEmailVerified = onEmailVerified
    this.onLogin = onLogin
    this.onError = onError

    firebase.auth().onAuthStateChanged(user => {
      if (user && user.isAnonymous) {
        console.log('Deprecated, user exists and is anonymous ', user.uid)
        return
      }

      if (user) {
        console.log('User exists: ', user)

        // Determine if user needs to verify email
        const emailVerified =
          !user.providerData ||
          !user.providerData.length ||
          user.providerData[0].providerId != 'password' ||
          user.emailVerified

        const profile = {
          id: user.uid,
          email: user.email,
          displayName: user.providerData[0].displayName,
          photoURL: user.providerData[0].photoURL,
          provider: user.providerData[0].providerId,
          lastSeen: Date.now(),
          emailVerified
        }

        const userDoc = firebaseDb.collection('users').doc(user.uid)
        userDoc.get().then(u => {
          if (u.data()) {
            console.log('Update profile')
            userDoc.update(profile)
          } else {
            console.log('Set profile')
            userDoc.set(profile)
          }
        })

        const unsubscribe = userDoc.onSnapshot(doc => {
          const data = doc.data()

          if (data) unsubscribe()

          if (!this.user) {
            // Get studies - TODO: DO IT BETTER
            const studies = {}
            firebaseDb
              .collection('studies')
              .where('user.id', '==', user.uid)
              .get()
              .then(querySnapshot => {
                querySnapshot.forEach(doc => {
                  const study = doc.data()
                  studies[study.id] = study
                })

                if (data && studies) {
                  if (!data.bible) data.bible = {}
                  data.bible.studies = studies
                }

                this.onLogin && this.onLogin(data || {}) // On login
              })
          } else if (data) {
            this.onLogin && this.onLogin(data || {}) // On updated
          }

          this.user = user // Store user
        })

        if (!__DEV__) {
          Segment.identifyWithTraits(user.uid, profile)
          Sentry.setUser(profile)
        }
        return
      }

      console.log('No user, do nothing...')
      this.user = null
    })
  }

  facebookLogin = () =>
    new Promise(async (resolve, reject) => {
      try {
        const { type, token } = await Facebook.logInWithReadPermissionsAsync('312719079612015', {
          permissions: ['public_profile', 'email']
        })

        if (type === 'success' && token) {
          // Build Firebase credential with the Facebook access token.
          const credential = firebase.auth.FacebookAuthProvider.credential(token)
          return this.onCredentialSuccess(credential, resolve)
        }
      } catch (e) {
        SnackBar.show('Une erreur est survenue.')
        console.log(e)
        Sentry.captureException(e)
        return resolve(false)
      }
    })

  googleLogin = () =>
    new Promise(async (resolve, reject) => {
      try {
        const result = await Google.logInAsync({
          androidClientId:
            '204116128917-95eiop5au3ftj8h87234f0ga0jpg29g1.apps.googleusercontent.com',
          iosClientId: '204116128917-q1pl4f4pt4tflfetgb905e9b4e34pu61.apps.googleusercontent.com',
          scopes: ['profile', 'email', 'openid']
        })

        if (result.type === 'success') {
          const googleUser = result

          const credential = firebase.auth.GoogleAuthProvider.credential(
            googleUser.idToken,
            googleUser.accessToken
          )

          return this.onCredentialSuccess(credential, resolve)
        }

        SnackBar.show('Connexion annulée.')
        return resolve(false)
      } catch (e) {
        SnackBar.show('Une erreur est survenue')
        console.log(e)
        Sentry.captureException(e)
        return resolve(false)
      }
    })

  onCredentialSuccess = async (credential, resolve) => {
    try {
      const user = await firebase.auth().signInWithCredential(credential)

      console.log('user signed in ', user)
      SnackBar.show('Connexion réussie')
      return resolve(true)
    } catch (e) {
      console.log(e.code)
      if (e.code === 'auth/account-exists-with-different-credential') {
        SnackBar.show('Cet utilisateur existe déjà avec un autre compte.', 'danger')
      }
      return resolve(false)
    }
  }

  logout = () => {
    firebase.auth().signOut()
    // Sign-out successful.
    this.user = null
    this.onLogout && this.onLogout()
    SnackBar.show('Vous êtes déconnecté.')
  }
}

export default new FireAuth()
