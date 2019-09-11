import * as firebase from 'firebase'
import * as Google from 'expo-google-app-auth'
import * as Facebook from 'expo-facebook'
import * as AppAuth from 'expo-app-auth'
import 'firebase/firestore'
import * as Segment from 'expo-analytics-segment'
import Sentry from 'sentry-expo'

import { firebaseConfig } from '../../config'
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

    firebase.auth().onAuthStateChanged(async user => {
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

        let remoteLastSeen = null

        const userDoc = firebaseDb.collection('users').doc(user.uid)
        let userData = await userDoc.get()
        let data = userData.data()

        if (data) {
          console.log('Update profile, last seen:', data.lastSeen)
          remoteLastSeen = data.lastSeen

          await userDoc.update(profile)
        } else {
          console.log('Set profile')
          await userDoc.set(profile)
        }

        userData = await userDoc.get()
        data = userData.data()

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

              this.onLogin && this.onLogin(data || {}, remoteLastSeen, studies) // On login
            })
        }

        this.user = user // Store user

        if (!__DEV__) {
          Segment.identifyWithTraits(user.uid, profile)
        }
        Sentry.setUserContext(profile)
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
          androidClientId: firebaseConfig.androidClientId,
          androidStandaloneAppClientId: firebaseConfig.androidStandaloneAppClientId,
          iosClientId: firebaseConfig.iosClientId,
          iosStandaloneAppClientId: firebaseConfig.iosStandaloneAppClientId,
          scopes: ['profile', 'email', 'openid'],
          redirectUrl: `${AppAuth.OAuthRedirect}:/oauth2redirect/google`
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
