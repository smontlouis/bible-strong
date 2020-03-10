import auth from '@react-native-firebase/auth'
import analytics from '@react-native-firebase/analytics'

import { GoogleSignin } from '@react-native-community/google-signin'
import { LoginManager, AccessToken } from 'react-native-fbsdk'

import * as Sentry from '@sentry/react-native'
import * as SecureStore from 'expo-secure-store'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Network from 'expo-network'

import SnackBar from '~common/SnackBar'
import { firebaseDb } from '~helpers/firebase'
import { APP_FETCH_DATA, APP_FETCH_DATA_FAIL } from '~redux/modules/user'

const FireAuth = class {
  user = null

  profile = null

  onUserChange = null

  onLogout = null

  onEmailVerified = null

  onLogin = null

  onError = null

  async init(
    onLogin,
    onUserChange,
    onLogout,
    onEmailVerified,
    onError,
    dispatch
  ) {
    this.onUserChange = onUserChange
    this.onLogout = onLogout
    this.onEmailVerified = onEmailVerified
    this.onLogin = onLogin
    this.onError = onError

    GoogleSignin.configure({
      scopes: ['profile', 'email', 'openid']
    })

    auth().onAuthStateChanged(async user => {
      const { isConnected } = await Network.getNetworkStateAsync()
      if (!isConnected) return

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
          ...(user.providerData[0].displayName && {
            displayName: user.providerData[0].displayName
          }),
          photoURL: user.providerData[0].photoURL,
          provider: user.providerData[0].providerId,
          lastSeen: Date.now(),
          emailVerified
        }

        let remoteLastSeen = null

        const userDoc = firebaseDb.collection('users').doc(user.uid)

        dispatch({ type: APP_FETCH_DATA })
        let userData
        try {
          userData = await userDoc.get()
        } catch (e) {
          dispatch({ type: APP_FETCH_DATA_FAIL })
          console.log('Erreur')
          console.log(e)
        }
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

              if (this.onLogin)
                this.onLogin(data || {}, remoteLastSeen, studies) // On login
            })
        }

        this.user = user // Store user

        if (!__DEV__) {
          analytics().setUserId(profile.id)
        }
        Sentry.configureScope(scope => {
          scope.setUser(profile)
        })
        return
      }

      console.log('No user, do nothing...')
      this.user = null
    })
  }

  appleLogin = () =>
    new Promise(async resolve => {
      // await SecureStore.deleteItemAsync('appleEmail')
      // await SecureStore.deleteItemAsync('applePassword')

      let email = await SecureStore.getItemAsync('appleEmail')
      let password

      if (email) {
        console.log('email exists')
        password = await SecureStore.getItemAsync('applePassword')
        const success = await this.login(email, password)
        resolve(success)
      } else {
        console.log("email doesn't exist")
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL
            ]
          })

          // signed in
          console.log(credential)

          email = credential.email
          password = credential.user

          const { givenName, familyName } = credential.fullName
          const username = `${givenName} ${familyName}`.trim()

          const success = await this.register(username, email, password)

          if (success) {
            await SecureStore.setItemAsync('appleEmail', email)
            await SecureStore.setItemAsync('applePassword', password)
          }

          resolve(success)
        } catch (e) {
          if (e.code === 'ERR_CANCELED') {
            console.log('ERR_CANCELED')
          } else {
            console.log('OTHER_ERROR', e)
          }
          resolve(false)
        }
      }
    })

  facebookLogin = () =>
    new Promise(async resolve => {
      try {
        const result = await LoginManager.logInWithPermissions([
          'public_profile',
          'email'
        ])

        console.log(result)

        if (!result.isCancelled) {
          const { accessToken } = await AccessToken.getCurrentAccessToken()
          // Build Firebase credential with the Facebook access token.
          const credential = auth.FacebookAuthProvider.credential(accessToken)
          return this.onCredentialSuccess(credential, resolve)
        }

        SnackBar.show('Connexion annulée.')
        return resolve(false)
      } catch (e) {
        SnackBar.show('Une erreur est survenue.')
        console.log(e)
        Sentry.captureException(e)
        return resolve(false)
      }
    })

  googleLogin = () =>
    new Promise(async resolve => {
      try {
        const { idToken } = await GoogleSignin.signIn()
        const { accessToken } = await GoogleSignin.getTokens()

        const credential = auth.GoogleAuthProvider.credential(
          idToken,
          accessToken
        )

        return this.onCredentialSuccess(credential, resolve)

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
      const user = await auth().signInWithCredential(credential)

      console.log('user signed in ', user)
      SnackBar.show('Connexion réussie')
      return resolve(true)
    } catch (e) {
      console.log(e.code)
      if (e.code === 'auth/account-exists-with-different-credential') {
        SnackBar.show(
          'Cet utilisateur existe déjà avec un autre compte.',
          'danger'
        )
      }
      return resolve(false)
    }
  }

  login = (email, password) =>
    new Promise(async resolve => {
      try {
        auth()
          .signInWithEmailAndPassword(email, password)
          .then(() => {
            resolve(true)
          })
          .catch(err => {
            if (this.onError) this.onError(err)
            resolve(false)
          })
      } catch (e) {
        if (this.onError) this.onError(e)
        resolve(false)
      }
    })

  resetPassword = email =>
    new Promise(async resolve => {
      try {
        auth()
          .sendPasswordResetEmail(email)
          .then(() => {
            SnackBar.show('Email envoyé.')
            resolve(false)
          })
          .catch(err => {
            if (this.onError) this.onError(err)
            resolve(false)
          })
      } catch (e) {
        if (this.onError) this.onError(e)
        resolve(false)
      }
    })

  register = (username, email, password) =>
    new Promise(async resolve => {
      try {
        auth()
          .createUserWithEmailAndPassword(email, password)
          .then(({ user }) => {
            firebaseDb
              .collection('users')
              .doc(user.uid)
              .set({ displayName: username })
            user.sendEmailVerification()
            return resolve(true)
          })
          .catch(err => {
            if (this.onError) this.onError(err)
            return resolve(false)
          })
      } catch (e) {
        if (this.onError) this.onError(e)
        return resolve(false)
      }
    })

  logout = () => {
    auth().signOut()
    // Sign-out successful.
    this.user = null
    if (this.onLogout) this.onLogout()
    SnackBar.show('Vous êtes déconnecté.')
  }
}

export default new FireAuth()
