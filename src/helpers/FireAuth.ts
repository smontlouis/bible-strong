import appleAuth from '@invertase/react-native-apple-authentication'
import { getAnalytics, setUserId as analyticsSetUserId } from '@react-native-firebase/analytics'
import {
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  AppleAuthProvider,
  GoogleAuthProvider,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from '@react-native-firebase/auth'
import { GoogleSignin } from '@react-native-google-signin/google-signin'
import * as Sentry from '@sentry/react-native'
import { toast } from '~helpers/toast'
import { firebaseDb, doc, setDoc, getDoc } from '~helpers/firebase'
import { tokenManager } from '~helpers/TokenManager'
import { runAllCleanups } from '~helpers/cleanupRegistry'
import i18n from '~i18n'

export type FireAuthProfile = {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  emailVerified: boolean
  createdAt: string | null
}

const FireAuth = class {
  authFlag = false

  user = null

  profile = null

  onUserChange = null

  onLogout = null

  onEmailVerified = null

  onLogin = null

  onError = null

  previousEmailVerified = false

  async init(
    onLogin: any,
    onUserChange: any,
    onLogout: any,
    onEmailVerified: any,
    onError: any,
    dispatch: any
  ) {
    this.onUserChange = onUserChange
    this.onLogout = onLogout
    this.onEmailVerified = onEmailVerified
    this.onLogin = onLogin
    this.onError = onError

    GoogleSignin.configure({
      scopes: ['profile', 'email', 'openid'],
      webClientId: '204116128917-56eubi7hu2f0k3rnb6dn8q3sfv23588l.apps.googleusercontent.com',
    })

    const authInstance = getAuth()
    onAuthStateChanged(authInstance, async user => {
      if (user && user.isAnonymous) {
        console.log('[Auth] Deprecated, user exists and is anonymous', user.uid)
        return
      }

      if (user) {
        console.log('[Auth] User exists')

        // Determine if user needs to verify email
        const emailVerified =
          !user.providerData ||
          !user.providerData.length ||
          user.providerData[0]?.providerId !== 'password' ||
          user.emailVerified

        /**
         * 1.a. We retrieve the firebase Auth user profile
         */
        const profile: FireAuthProfile = {
          id: user.uid,
          email: user.email!,
          displayName: user.providerData[0]?.displayName || '',
          photoURL: user.providerData[0]?.photoURL || '',
          provider: user.providerData[0]?.providerId || '',
          emailVerified,
          createdAt: user.metadata.creationTime || null,
        }

        /**
         * 1.b. Fetch Firestore user document to get displayName (source of truth)
         */
        try {
          const userDoc = await getDoc(doc(firebaseDb, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            if (userData?.displayName) {
              profile.displayName = userData.displayName
            }
            if (userData?.photoURL) {
              profile.photoURL = userData.photoURL
            }
          }
        } catch (e) {
          console.log('[Auth] Error fetching user document from Firestore:', e)
        }

        if (!this.user) {
          if (this.onLogin) {
            /**
             * 1.c. We call the onLogin callback dispatching onUserLoginSuccess
             */
            // @ts-ignore
            this.onLogin({ profile })
          }

          // @ts-ignore
          this.user = user // Store user
          this.previousEmailVerified = emailVerified

          if (!__DEV__) {
            analyticsSetUserId(getAnalytics(), profile.id)
          }
          Sentry.getCurrentScope().setUser(profile)
          return
        }

        // Check if emailVerified status changed (user verified email while app was open)
        if (!this.previousEmailVerified && emailVerified) {
          console.log('[Auth] Email verification detected!')
          // @ts-ignore
          this.onEmailVerified?.()
        }
        this.previousEmailVerified = emailVerified
        return
      }

      console.log('[Auth] No user, do nothing...')
      this.user = null
      this.previousEmailVerified = false
    })
  }

  appleLogin = () =>
    new Promise(async resolve => {
      try {
        const appleAuthRequestResponse = await appleAuth.performRequest({
          requestedOperation: appleAuth.Operation.LOGIN,
          requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        })

        const { identityToken, nonce } = appleAuthRequestResponse

        // can be null in some scenarios
        if (identityToken) {
          // 3). create a Firebase `AppleAuthProvider` credential
          const appleCredential = AppleAuthProvider.credential(identityToken, nonce)
          const userCredential = await signInWithCredential(getAuth(), appleCredential)

          console.log(`[Auth] Firebase authenticated via Apple, UID: ${userCredential.user.uid}`)
          resolve(false)
        } else {
          resolve(false)
        }
      } catch (e: any) {
        if (e.code === 'ERR_CANCELED') {
          console.log('[Auth] ERR_CANCELED')
        } else {
          console.log('[Auth] OTHER_ERROR', e)
        }
        resolve(false)
      }
    })

  // facebookLogin = () =>
  //   new Promise(async resolve => {
  //     try {
  //       const result = await LoginManager.logInWithPermissions([
  //         'public_profile',
  //         'email',
  //       ])

  //       if (!result.isCancelled) {
  //         const { accessToken } = await AccessToken.getCurrentAccessToken()
  //         // Build Firebase credential with the Facebook access token.
  //         const credential = auth.FacebookAuthProvider.credential(accessToken)
  //         return this.onCredentialSuccess(credential, resolve)
  //       }

  //       SnackBar.show(i18n.t('Connexion annulée.'))
  //       return resolve(false)
  //     } catch (e) {
  //       SnackBar.show(i18n.t('Une erreur est survenue.'))
  //       console.log(e)
  //       Sentry.captureException(e)
  //       return resolve(false)
  //     }
  //   })

  googleLogin = () =>
    new Promise(async resolve => {
      try {
        await GoogleSignin.hasPlayServices()
        const signInResult = await GoogleSignin.signIn()
        const idToken = signInResult.data?.idToken

        if (!idToken) {
          throw new Error('No ID token found')
        }

        const googleCredential = GoogleAuthProvider.credential(idToken)
        return this.onCredentialSuccess(googleCredential, resolve)
      } catch (e) {
        toast.error(i18n.t('Une erreur est survenue'))
        console.log('[Auth] Google login error:', e)
        return resolve(false)
      }
    })

  onCredentialSuccess = async (credential: any, resolve: any) => {
    try {
      const user = await signInWithCredential(getAuth(), credential)

      console.log('[Auth] User signed in', user)
      toast.success(i18n.t('Connexion réussie'))
      return resolve(true)
    } catch (e: any) {
      console.log('[Auth] Error code:', e.code)
      if (e.code === 'auth/account-exists-with-different-credential') {
        toast.error(i18n.t('Cet utilisateur existe déjà avec un autre compte.'))
      }
      return resolve(false)
    }
  }

  login = (email: any, password: any) =>
    new Promise(async resolve => {
      try {
        signInWithEmailAndPassword(getAuth(), email.trim(), password.trim())
          .then(() => {
            // @ts-ignore
            resolve(true)
          })
          .catch(err => {
            if (this.onError) {
              // @ts-ignore
              this.onError(err)
            }
            resolve(false)
          })
      } catch (e) {
        if (this.onError) {
          // @ts-ignore
          this.onError(e)
        }
        resolve(false)
      }
    })

  sendEmailVerification = async () => {
    const user = getAuth().currentUser
    try {
      // @ts-ignore
      await user.sendEmailVerification()
      toast.success(i18n.t('Email envoyé'))
    } catch (e: any) {
      if (e.code === 'auth/too-many-requests') {
        toast.error(i18n.t('Un mail a déjà été envoyé. Réessayez plus tard'))
      } else {
        toast.error(i18n.t("Impossible d'envoyer l'email"))
      }
    }
  }

  resetPassword = (email: any) =>
    new Promise(async resolve => {
      try {
        sendPasswordResetEmail(getAuth(), email)
          .then(() => {
            toast.success(i18n.t('Email envoyé.'))
            // @ts-ignore
            resolve(false)
          })
          .catch(err => {
            if (this.onError) {
              // @ts-ignore
              this.onError(err)
            }
            resolve(false)
          })
      } catch (e) {
        if (this.onError) {
          // @ts-ignore
          this.onError(e)
        }
        resolve(false)
      }
    })

  register = (username: any, email: any, password: any) =>
    new Promise(async resolve => {
      try {
        createUserWithEmailAndPassword(getAuth(), email, password)
          .then(({ user }) => {
            setDoc(doc(firebaseDb, 'users', user.uid), { displayName: username }, { merge: true })

            user.sendEmailVerification()
            // @ts-ignore
            return resolve(true)
          })
          .catch(err => {
            if (this.onError) {
              // @ts-ignore
              this.onError(err)
            }
            return resolve(false)
          })
      } catch (e) {
        if (this.onError) {
          // @ts-ignore
          this.onError(e)
        }
        return resolve(false)
      }
    })

  updateDisplayName = async (displayName: string) => {
    const user = getAuth().currentUser
    if (!user) {
      toast.error(i18n.t('profile.notLoggedIn'))
      return false
    }

    try {
      await updateProfile(user, { displayName })
      await setDoc(doc(firebaseDb, 'users', user.uid), { displayName }, { merge: true })
      toast.success(i18n.t('profile.nameUpdated'))
      return true
    } catch (e) {
      console.log('[Auth] Error updating display name:', e)
      toast.error(i18n.t('profile.updateError'))
      Sentry.captureException(e)
      return false
    }
  }

  updatePhotoURL = async (photoURL: string) => {
    const user = getAuth().currentUser
    if (!user) {
      toast.error(i18n.t('profile.notLoggedIn'))
      return false
    }

    try {
      await updateProfile(user, { photoURL })
      await setDoc(doc(firebaseDb, 'users', user.uid), { photoURL }, { merge: true })
      toast.success(i18n.t('profile.photoUpdated'))
      return true
    } catch (e) {
      console.log('[Auth] Error updating photo URL:', e)
      toast.error(i18n.t('profile.updateError'))
      Sentry.captureException(e)
      return false
    }
  }

  changePassword = async (currentPassword: string, newPassword: string) => {
    const user = getAuth().currentUser
    if (!user || !user.email) {
      toast.error(i18n.t('profile.notLoggedIn'))
      return false
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      toast.success(i18n.t('profile.passwordUpdated'))
      return true
    } catch (e: any) {
      console.log('[Auth] Error changing password:', e.code)
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        toast.error(i18n.t('profile.wrongPassword'))
      } else if (e.code === 'auth/weak-password') {
        toast.error(i18n.t('profile.weakPassword'))
      } else {
        toast.error(i18n.t('profile.updateError'))
      }
      Sentry.captureException(e)
      return false
    }
  }

  loginWithCustomToken = (token: string) =>
    new Promise(async resolve => {
      if (!__DEV__) {
        console.log('[Auth] Custom token login only available in dev')
        resolve(false)
        return
      }
      try {
        await signInWithCustomToken(getAuth(), token)
        toast.success(i18n.t('Connexion réussie'))
        resolve(true)
      } catch (e) {
        console.log('[Auth] Custom token error:', e)
        toast.error(i18n.t('Token invalide'))
        resolve(false)
      }
    })

  logout = async () => {
    // Cleanup Firestore subscriptions BEFORE signOut to avoid permission-denied errors
    runAllCleanups()

    // Small delay to let async cleanup operations complete
    await new Promise(resolve => setTimeout(resolve, 50))

    signOut(getAuth())

    // Sign-out successful.
    this.user = null
    // @ts-ignore
    this.onLogout?.()

    // Reset token manager state
    tokenManager.reset()

    toast(i18n.t('Vous êtes déconnecté.'))
  }

  /**
   * Manually check if email has been verified
   * Call this after user clicks verification link and returns to app
   */
  checkEmailVerification = async (): Promise<boolean> => {
    const user = getAuth().currentUser
    if (!user) return false

    try {
      await user.reload()
      const refreshedUser = getAuth().currentUser

      if (refreshedUser?.emailVerified && !this.previousEmailVerified) {
        console.log('[Auth] Email verified after manual check!')
        this.previousEmailVerified = true
        // @ts-ignore
        this.onEmailVerified?.()
        return true
      }

      return refreshedUser?.emailVerified || false
    } catch (e) {
      console.log('[Auth] Error checking email verification:', e)
      return false
    }
  }
}

export default new FireAuth()
