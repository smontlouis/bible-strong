import * as Sentry from '@sentry/react-native'
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAdditionalUserInfo,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type AuthCredential,
  type User,
} from 'firebase/auth'

import { doc, firebaseDb, getDoc, setDoc } from '~helpers/firebase'
import i18n from '~i18n'
import type { AppDispatch } from '~redux/store'
import {
  AccountEntryAttemptCoordinator,
  classifyAccountEntry,
  createUnresolvedAccountEntryRepository,
  preserveUnresolvedAccountEntryClassification,
  type AccountEntryClassification,
  type AccountEntryOperation,
} from './accountEntry'
import { appLogger } from './agentObservability'
import { runAllCleanups } from './cleanupRegistry'
import { firebaseApp } from './firebaseApp.web'
import { storage } from './storage'
import { toast } from './toast'
import { tokenManager } from './TokenManager'

export type FireAuthProfile = {
  id: string
  email: string
  displayName: string
  photoURL: string
  provider: string
  emailVerified: boolean
  createdAt: string | null
}

type OnLoginCallback = (payload: {
  profile: FireAuthProfile
  accountEntryClassification: AccountEntryClassification
}) => void
type OnUserChangeCallback = (profile: FireAuthProfile) => void
type VoidCallback = () => void
type AuthErrorCallback = (error: unknown) => void
type AccountEntryProvider = 'apple.com' | 'google.com' | 'password' | 'custom-token'

const getErrorCode = (error: unknown) =>
  error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined

export class WebFireAuth {
  user: User | null = null
  profile: FireAuthProfile | null = null
  onUserChange: OnUserChangeCallback | null = null
  onLogout: VoidCallback | null = null
  onEmailVerified: VoidCallback | null = null
  onLogin: OnLoginCallback | null = null
  onError: AuthErrorCallback | null = null
  previousEmailVerified = false
  accountEntryAttempts = new AccountEntryAttemptCoordinator()
  unresolvedAccountEntries = createUnresolvedAccountEntryRepository(storage)

  private beginAccountEntryAttempt(
    operation: AccountEntryOperation,
    provider: AccountEntryProvider
  ) {
    const startedAt = Date.now()
    const attempt = this.accountEntryAttempts.begin(operation)
    appLogger.info('sync', 'account_entry.authentication_started', {
      lifecycleState: 'authenticating',
      operation,
      provider,
    })

    return {
      complete: (result: { userId: string; credentialIsNewUser?: boolean }) => {
        const classification = classifyAccountEntry({
          operation,
          credentialIsNewUser: result.credentialIsNewUser,
        })
        attempt.complete(result)
        appLogger.info('sync', 'account_entry.authentication_completed', {
          lifecycleState: 'classified',
          operation,
          provider,
          classification,
          durationMs: Date.now() - startedAt,
        })
      },
      fail: () => attempt.fail(),
    }
  }

  async init(
    onLogin: OnLoginCallback,
    onUserChange: OnUserChangeCallback,
    onLogout: VoidCallback,
    onEmailVerified: VoidCallback,
    onError: AuthErrorCallback,
    _dispatch: AppDispatch
  ) {
    this.onLogin = onLogin
    this.onUserChange = onUserChange
    this.onLogout = onLogout
    this.onEmailVerified = onEmailVerified
    this.onError = onError

    onAuthStateChanged(getAuth(firebaseApp), async user => {
      if (!user) {
        const wasAuthenticated = Boolean(this.user)
        this.user = null
        this.profile = null
        this.previousEmailVerified = false
        if (wasAuthenticated) {
          runAllCleanups()
          tokenManager.reset()
          Sentry.getCurrentScope().setUser(null)
          this.onLogout?.()
        }
        return
      }

      const accountEntryClassification = preserveUnresolvedAccountEntryClassification({
        classification: await this.accountEntryAttempts.classifyAuthenticatedUser(user.uid),
        userId: user.uid,
        repository: this.unresolvedAccountEntries,
      })
      const primaryProvider = user.providerData[0]
      const emailVerified = primaryProvider?.providerId !== 'password' || user.emailVerified
      const profile: FireAuthProfile = {
        id: user.uid,
        email: user.email ?? '',
        displayName: primaryProvider?.displayName ?? user.displayName ?? '',
        photoURL: primaryProvider?.photoURL ?? user.photoURL ?? '',
        provider: primaryProvider?.providerId ?? '',
        emailVerified,
        createdAt: user.metadata.creationTime ?? null,
      }

      try {
        const userDocument = await getDoc(doc(firebaseDb, 'users', user.uid))
        if (userDocument.exists()) {
          const data = userDocument.data()
          if (data && typeof data.displayName === 'string') profile.displayName = data.displayName
          if (data && typeof data.photoURL === 'string') profile.photoURL = data.photoURL
        }
      } catch (error) {
        appLogger.warn('sync', 'web_auth.profile_read_failed', { error })
      }

      if (!this.user) {
        this.user = user
        this.profile = profile
        this.previousEmailVerified = emailVerified
        this.onLogin?.({ profile, accountEntryClassification })
        Sentry.getCurrentScope().setUser(profile)
        return
      }

      this.profile = profile
      this.onUserChange?.(profile)
      if (!this.previousEmailVerified && emailVerified) this.onEmailVerified?.()
      this.previousEmailVerified = emailVerified
    })
  }

  private providerLogin = async (provider: GoogleAuthProvider | OAuthProvider) => {
    const providerId = provider.providerId as AccountEntryProvider
    const attempt = this.beginAccountEntryAttempt('provider-sign-in', providerId)
    try {
      const credential = await signInWithPopup(getAuth(firebaseApp), provider)
      attempt.complete({
        userId: credential.user.uid,
        credentialIsNewUser: getAdditionalUserInfo(credential)?.isNewUser,
      })
      return false
    } catch (error) {
      attempt.fail()
      if (getErrorCode(error) !== 'auth/popup-closed-by-user') this.onError?.(error)
      return false
    }
  }

  googleLogin = () => this.providerLogin(new GoogleAuthProvider())
  appleLogin = () => this.providerLogin(new OAuthProvider('apple.com'))

  onCredentialSuccess = async (_credential: AuthCredential, resolve: (value: boolean) => void) =>
    resolve(false)

  login = async (email: string, password: string): Promise<boolean> => {
    const attempt = this.beginAccountEntryAttempt('email-login', 'password')
    try {
      const credential = await signInWithEmailAndPassword(
        getAuth(firebaseApp),
        email.trim(),
        password.trim()
      )
      attempt.complete({
        userId: credential.user.uid,
        credentialIsNewUser: getAdditionalUserInfo(credential)?.isNewUser,
      })
      return true
    } catch (error) {
      attempt.fail()
      this.onError?.(error)
      return false
    }
  }

  resetPassword = async (email: string): Promise<boolean> => {
    try {
      await sendPasswordResetEmail(getAuth(firebaseApp), email)
      toast.success(i18n.t('Email envoyé.'))
    } catch (error) {
      this.onError?.(error)
    }
    return false
  }

  register = async (username: string, email: string, password: string): Promise<boolean> => {
    const attempt = this.beginAccountEntryAttempt('email-registration', 'password')
    try {
      const credential = await createUserWithEmailAndPassword(getAuth(firebaseApp), email, password)
      attempt.complete({
        userId: credential.user.uid,
        credentialIsNewUser: getAdditionalUserInfo(credential)?.isNewUser,
      })
      await Promise.all([
        updateProfile(credential.user, { displayName: username }),
        setDoc(
          doc(firebaseDb, 'users', credential.user.uid),
          { displayName: username },
          { merge: true }
        ),
        sendEmailVerification(credential.user),
      ])
      return true
    } catch (error) {
      attempt.fail()
      this.onError?.(error)
      return false
    }
  }

  sendEmailVerification = async () => {
    const user = getAuth(firebaseApp).currentUser
    if (!user) return
    try {
      await sendEmailVerification(user)
      toast.success(i18n.t('Email envoyé'))
    } catch (error) {
      this.onError?.(error)
    }
  }

  updateDisplayName = async (displayName: string) => {
    const user = getAuth(firebaseApp).currentUser
    if (!user) return false
    try {
      await Promise.all([
        updateProfile(user, { displayName }),
        setDoc(doc(firebaseDb, 'users', user.uid), { displayName }, { merge: true }),
      ])
      return true
    } catch (error) {
      Sentry.captureException(error)
      return false
    }
  }

  updatePhotoURL = async (photoURL: string) => {
    const user = getAuth(firebaseApp).currentUser
    if (!user) return false
    try {
      await Promise.all([
        updateProfile(user, { photoURL }),
        setDoc(doc(firebaseDb, 'users', user.uid), { photoURL }, { merge: true }),
      ])
      return true
    } catch (error) {
      Sentry.captureException(error)
      return false
    }
  }

  changePassword = async (currentPassword: string, newPassword: string) => {
    const user = getAuth(firebaseApp).currentUser
    if (!user?.email) return false
    try {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email, currentPassword)
      )
      await updatePassword(user, newPassword)
      return true
    } catch (error) {
      this.onError?.(error)
      return false
    }
  }

  loginWithCustomToken = async (token: string): Promise<boolean> => {
    if (!__DEV__) return false
    const attempt = this.beginAccountEntryAttempt('email-login', 'custom-token')
    try {
      const credential = await signInWithCustomToken(getAuth(firebaseApp), token)
      attempt.complete({ userId: credential.user.uid })
      return true
    } catch (error) {
      attempt.fail()
      this.onError?.(error)
      return false
    }
  }

  logout = async () => {
    await signOut(getAuth(firebaseApp))
    if (this.user) {
      runAllCleanups()
      this.user = null
      this.profile = null
      this.previousEmailVerified = false
      tokenManager.reset()
      Sentry.getCurrentScope().setUser(null)
      this.onLogout?.()
    }
    toast(i18n.t('Vous êtes déconnecté.'))
  }

  checkEmailVerification = async () => {
    const user = getAuth(firebaseApp).currentUser
    if (!user) return false
    await reload(user)
    if (user.emailVerified && !this.previousEmailVerified) {
      this.previousEmailVerified = true
      this.onEmailVerified?.()
    }
    return user.emailVerified
  }
}

export default new WebFireAuth()
