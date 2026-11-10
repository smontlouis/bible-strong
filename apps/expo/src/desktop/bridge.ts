import { Channel, invoke } from '@tauri-apps/api/core'

/** What the shell serves before the bundle runs (`apps/desktop/src-tauri/src/bootstrap.rs`). */
export type DesktopBootstrap = {
  /** `file://` URI ending with `/`, as `FileSystem.documentDirectory`. */
  documentDirectory: string
  cacheDirectory: string
  /** Offline-copy key versions compiled into this binary (ADR-0065). */
  archiveKeyVersions: number[]
  platform: 'macos' | 'windows' | 'linux'
  appVersion: string
  /** False in the Mac App Store build, which the store updates. */
  updater: boolean
  /**
   * How this build reaches readers: `direct` for the installers, `mac_app_store` for the Mac App
   * Store build. Missing in a shell older than this field. It decides the sales channel.
   */
  distribution?: 'direct' | 'mac_app_store'
  /** The key-value store when the page loaded. */
  kv: Record<string, string>
}

declare global {
  var __BIBLE_STRONG_DESKTOP__: DesktopBootstrap | undefined
  var __BIBLE_STRONG_DESKTOP_ERROR__: string | undefined
}

/** Starting without this state would start an empty app over the reader's data: refuse. */
export const desktopBootstrap = (): DesktopBootstrap => {
  const bootstrap = globalThis.__BIBLE_STRONG_DESKTOP__
  if (!bootstrap) {
    throw new Error(globalThis.__BIBLE_STRONG_DESKTOP_ERROR__ ?? 'DESKTOP_BOOTSTRAP_MISSING')
  }
  return bootstrap
}

export { Channel, invoke }
