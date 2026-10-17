// Scans of a stand's QR code (docs/production.md): the code leads to a scan address, which
// counts the scan here and sends the phone on to its place. No address is kept: a visitor is a
// hash of the network address and the browser with a salt of the day, forgotten the next day,
// so one person counts once a day and cannot be followed from one day to the next.
import { DurableObject } from 'cloudflare:workers'
import { ScanStore } from './scan-store'
export { scanReport } from './scan-store'

/** The single counter, addressed by this name. */
export const SCAN_INSTANCE = 'stands'
/** Each scan address and the place it leads to. */
export const SCAN_ROUTES: Record<string, string> = { '/scan': '/valence-1876' }

export interface ScanEnv {
  ScanCounter: DurableObjectNamespace<ScanCounter>
}
export class ScanCounter extends DurableObject<ScanEnv> {
  private store: ScanStore
  constructor(ctx: DurableObjectState, env: ScanEnv) {
    super(ctx, env)
    this.store = new ScanStore(ctx.storage.sql)
  }
  record(source: string, client: string, at: number) {
    return this.store.record(source, client, at)
  }
  stats() {
    return this.store.stats()
  }
}
