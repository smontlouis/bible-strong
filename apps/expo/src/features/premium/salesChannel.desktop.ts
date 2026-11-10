import { desktopBootstrap } from '~desktop/bridge'

import type { SalesChannel } from './salesChannel'

export type { SalesChannel }
export { sellsThroughStripe } from './salesChannel'

/**
 * The desktop app sells Premium through the web checkout, opened in the reader's browser, only
 * in its installer builds (ADR-0110). The Mac App Store build must not show a web price or a
 * link to it: it sells nothing until StoreKit reaches it. Its shell states its distribution;
 * the updater, which only the installer builds carry, is checked too, so that a shell that
 * states none sells nothing.
 */
export const salesChannel = (): SalesChannel => {
  const { distribution, updater } = desktopBootstrap()
  return distribution === 'direct' && updater ? 'web_link' : 'none'
}
