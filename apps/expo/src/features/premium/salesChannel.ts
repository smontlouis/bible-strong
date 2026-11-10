import { Platform } from 'react-native'

/**
 * Where this surface sells Premium (ADR-0110):
 * - `app_store`: the iOS app, the iPad app on a Mac included;
 * - `play_store`: the Android app;
 * - `web`: the web workspace, through the checkout run by Stripe in the page;
 * - `web_link`: the installer builds of the desktop app, which open the same checkout in the
 *   reader's browser (`salesChannel.desktop.ts`);
 * - `none`: nothing is sold here (the Mac App Store build until StoreKit reaches it).
 */
export type SalesChannel = 'app_store' | 'play_store' | 'web' | 'web_link' | 'none'

export const salesChannel = (): SalesChannel => {
  if (Platform.OS === 'ios') return 'app_store'
  if (Platform.OS === 'android') return 'play_store'
  if (Platform.OS === 'web') return 'web'
  return 'none'
}

/** The sales channels whose checkout Stripe runs, where no store account is involved. */
export const sellsThroughStripe = (channel: SalesChannel) =>
  channel === 'web' || channel === 'web_link'
