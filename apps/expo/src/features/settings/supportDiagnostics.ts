import * as Sentry from '@sentry/react-native'
import * as Application from 'expo-application'
import * as Updates from 'expo-updates'
import { getCurrentAuthUser } from '~helpers/firebaseAuthRuntime'
import app from '../../../package.json'
import { getSupportDevice } from './supportDevice'

export function getSupportDiagnostics(language: string) {
  const user = getCurrentAuthUser()
  return {
    date: new Date().toISOString(),
    firebaseUid: user?.uid,
    account: user ? (user.isAnonymous ? 'anonymous' : 'signed-in') : 'guest',
    sentryUserId: Sentry.getCurrentScope().getUser()?.id,
    lastSentryEventId: Sentry.lastEventId(),
    appVersion: Application.nativeApplicationVersion ?? app.version,
    build: Application.nativeBuildVersion,
    applicationId: Application.applicationId,
    javascriptVersion: app.version,
    updateId: Updates.updateId,
    updateChannel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    embeddedUpdate: Updates.isEmbeddedLaunch,
    development: __DEV__,
    language,
    ...getSupportDevice(),
  }
}
