import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core'

type NativeAppCheckResult =
  | { token: string; expiresAtMillis: number; error?: never }
  | {
      error: { code: string; causes: { name: string; message: string; nativeCode?: string }[] }
      token?: never
    }

declare class BibleStrongAppCheckModule extends NativeModule {
  readonly provider: 'playIntegrity' | 'recaptchaEnterprise'
  initialize(appName: string): Promise<void>
  getTokenWithDiagnostics?(forceRefresh: boolean): Promise<NativeAppCheckResult>
  getToken(forceRefresh: boolean): Promise<{ token: string }>
}

// Older Android binaries and Apple builds continue to use the RNFirebase providers.
export default requireOptionalNativeModule<BibleStrongAppCheckModule>('BibleStrongAppCheck')
