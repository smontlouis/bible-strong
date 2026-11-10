// RevenueCat keeps the Premium customer of each account under its Firebase uid (ADR-0110), with
// its purchases and attributes. Deleting the account erases that customer through the V2 API,
// with a secret key that holds only the `customer_information:customers:read_write` permission.
// It is kept as the secret below (`firebase functions:secrets:set REVENUECAT_DELETION_API_KEY`);
// the assistant Worker has its own key, which only reads.
export const REVENUECAT_DELETION_SECRET = 'REVENUECAT_DELETION_API_KEY'

// RevenueCat's identifier of the Bible Strong project, not a secret.
const PROJECT_ID = 'proja6b849f6'
const CUSTOMERS_URL = `https://api.revenuecat.com/v2/projects/${PROJECT_ID}/customers`

const ATTEMPTS = 3
const TIMEOUT_MS = 10_000

// Locked, rate-limited and server errors may pass a moment later; the others will not.
const isRetryable = (status: number) => status === 423 || status === 429 || status >= 500

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// `requested`: RevenueCat queued the deletion. `absent`: it holds no customer for this uid, the
// case of every account that never signed in on a version selling Premium.
export type CustomerDeletion = 'requested' | 'absent'

export async function deleteRevenueCatCustomer(uid: string): Promise<CustomerDeletion> {
  const key = process.env[REVENUECAT_DELETION_SECRET]
  if (!key) throw new Error(`${REVENUECAT_DELETION_SECRET} is not set`)

  let failure: unknown
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await wait((attempt - 1) * 1000)
    try {
      const response = await fetch(`${CUSTOMERS_URL}/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (response.ok) return 'requested'
      if (response.status === 404) return 'absent'
      const detail = (await response.text().catch(() => '')).slice(0, 300)
      failure = new Error(`RevenueCat answered ${response.status} ${detail}`.trim())
      if (!isRetryable(response.status)) break
    } catch (error) {
      // Network failure or timeout.
      failure = error
    }
  }
  throw failure
}
