import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core'

declare class BibleStrongAppCheckModule extends NativeModule {
  readonly provider: 'playIntegrity' | 'recaptchaEnterprise'
  initialize(appName: string): Promise<void>
  getToken(forceRefresh: boolean): Promise<{ token: string }>
}

// Older Android binaries and Apple builds continue to use the RNFirebase providers.
export default requireOptionalNativeModule<BibleStrongAppCheckModule>('BibleStrongAppCheck')
