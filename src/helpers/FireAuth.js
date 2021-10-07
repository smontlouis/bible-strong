import appleAuth, {
  AppleAuthRequestOperation,
  AppleAuthRequestScope,
} from '@invertase/react-native-apple-authentication'
import { GoogleSignin } from '@react-native-community/google-signin'
import NetInfo from '@react-native-community/netinfo'
import analytics from '@react-native-firebase/analytics'
import auth from '@react-native-firebase/auth'
import * as Sentry from '@sentry/react-native'
import { AccessToken, LoginManager } from 'react-native-fbsdk-next'
import SnackBar from '~common/SnackBar'
import { firebaseDb } from '~helpers/firebase'
import i18n from '~i18n'
import { APP_FETCH_DATA } from '~redux/modules/user'

const FireAuth = class {
  authFlag = false

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
      scopes: ['profile', 'email', 'openid'],
    })

    auth().onAuthStateChanged(async user => {
      const { isConnected } = await NetInfo.fetch()
      if (!isConnected) {
        return
      }

      // Skip registration call
      if (!this.authFlag) {
        this.authFlag = true
        return
      }

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
          user.providerData[0].providerId !== 'password' ||
          user.emailVerified

        // TODO - Revoir ça pour connexion Apple
        const profile = {
          id: user.uid,
          email: user.email,
          displayName: user.providerData[0].displayName || '',
          photoURL: user.providerData[0].photoURL || '',
          provider: user.providerData[0].providerId,
          lastSeen: Date.now(),
          emailVerified,
        }

        const userStatusRef = firebaseDb
          .collection('users-status')
          .doc(user.uid)

        dispatch({ type: APP_FETCH_DATA })

        // GET USER STATUS
        const userStatusDoc = await userStatusRef.get()

        const userStatus = userStatusDoc.data() || {}
        const remoteLastSeen = userStatus.lastSeen || 0

        console.log('Online last seen:', new Date(remoteLastSeen))
        console.log('Seen now:', new Date(profile.lastSeen))

        if (!this.user) {
          if (this.onLogin) {
            this.onLogin({ profile, remoteLastSeen })
          } // On login
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
      try {
        const appleAuthRequestResponse = await appleAuth.performRequest({
          requestedOperation: AppleAuthRequestOperation.LOGIN,
          requestedScopes: [
            AppleAuthRequestScope.EMAIL,
            AppleAuthRequestScope.FULL_NAME,
          ],
        })

        const { identityToken, nonce } = appleAuthRequestResponse

        // can be null in some scenarios
        if (identityToken) {
          // 3). create a Firebase `AppleAuthProvider` credential
          const appleCredential = auth.AppleAuthProvider.credential(
            identityToken,
            nonce
          )
          const userCredential = await auth().signInWithCredential(
            appleCredential
          )

          console.log(
            `Firebase authenticated via Apple, UID: ${userCredential.user.uid}`
          )
          resolve(false)
        } else {
          resolve(false)
        }
      } catch (e) {
        if (e.code === 'ERR_CANCELED') {
          console.log('ERR_CANCELED')
        } else {
          console.log('OTHER_ERROR', e)
        }
        resolve(false)
      }
    })

  facebookLogin = () =>
    new Promise(async resolve => {
      try {
        const result = await LoginManager.logInWithPermissions([
          'public_profile',
          'email',
        ])

        console.log(result)

        if (!result.isCancelled) {
          const { accessToken } = await AccessToken.getCurrentAccessToken()
          // Build Firebase credential with the Facebook access token.
          const credential = auth.FacebookAuthProvider.credential(accessToken)
          return this.onCredentialSuccess(credential, resolve)
        }

        SnackBar.show(i18n.t('Connexion annulée.'))
        return resolve(false)
      } catch (e) {
        SnackBar.show(i18n.t('Une erreur est survenue.'))
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
      } catch (e) {
        SnackBar.show(i18n.t('Une erreur est survenue'))
        console.log(e)
        Sentry.captureException(e)
        return resolve(false)
      }
    })

  onCredentialSuccess = async (credential, resolve) => {
    try {
      const user = await auth().signInWithCredential(credential)

      console.log('user signed in ', user)
      SnackBar.show(i18n.t('Connexion réussie'))
      return resolve(true)
    } catch (e) {
      console.log(e.code)
      if (e.code === 'auth/account-exists-with-different-credential') {
        SnackBar.show(
          i18n.t('Cet utilisateur existe déjà avec un autre compte.'),
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
          .signInWithEmailAndPassword(email.trim(), password.trim())
          .then(() => {
            resolve(true)
          })
          .catch(err => {
            if (this.onError) {
              this.onError(err)
            }
            resolve(false)
          })
      } catch (e) {
        if (this.onError) {
          this.onError(e)
        }
        resolve(false)
      }
    })

  sendEmailVerification = async () => {
    const user = auth().currentUser
    try {
      await user.sendEmailVerification()
      SnackBar.show(i18n.t('Email envoyé'))
    } catch (e) {
      if (e.code === 'auth/too-many-requests') {
        SnackBar.show(i18n.t('Un mail a déjà été envoyé. Réessayez plus tard'))
      } else {
        SnackBar.show(i18n.t("Impossible d'envoyer l'email"))
      }
    }
  }

  resetPassword = email =>
    new Promise(async resolve => {
      try {
        auth()
          .sendPasswordResetEmail(email)
          .then(() => {
            SnackBar.show(i18n.t('Email envoyé.'))
            resolve(false)
          })
          .catch(err => {
            if (this.onError) {
              this.onError(err)
            }
            resolve(false)
          })
      } catch (e) {
        if (this.onError) {
          this.onError(e)
        }
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
            if (this.onError) {
              this.onError(err)
            }
            return resolve(false)
          })
      } catch (e) {
        if (this.onError) {
          this.onError(e)
        }
        return resolve(false)
      }
    })

  logout = () => {
    auth().signOut()
    // IAPHub.setUserId(null)

    // Sign-out successful.
    this.user = null
    if (this.onLogout) {
      this.onLogout()
    }
    SnackBar.show(i18n.t('Vous êtes déconnecté.'))
  }
}

export default new FireAuth()
