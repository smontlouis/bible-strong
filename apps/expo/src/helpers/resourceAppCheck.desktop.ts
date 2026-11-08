import type { AppCheck } from 'firebase/app-check'

import { createResourceAppCheckFetch } from './resourceAppCheckRequest'

/**
 * The desktop app attests nothing (ADR-0107). Since ADR-0065 online reading and encrypted
 * Offline copies need no App Check token, and the study assistant takes one as optional;
 * reCAPTCHA Enterprise does not accept the app's origin anyway. Only plain Offline copies
 * require a token, and the desktop app downloads the encrypted ones.
 */
export class ResourceAppCheckError extends Error {
  constructor(
    readonly code: string,
    readonly cause: unknown
  ) {
    super(code)
    this.name = 'ResourceAppCheckError'
  }
}

export const initializeResourceAppCheck = async (): Promise<AppCheck> => undefined as never

export const getResourceAppCheckToken = async (_forceRefresh = false): Promise<string> => {
  const cause = new Error('RESOURCE_APP_CHECK_UNAVAILABLE_ON_DESKTOP')
  throw new ResourceAppCheckError(cause.message, cause)
}

export const resourceApiFetch: typeof fetch = createResourceAppCheckFetch(
  fetch,
  getResourceAppCheckToken
)

export const getResourceDownloadAppCheckToken = (
  _url: string,
  forceRefresh = false
): Promise<string> => getResourceAppCheckToken(forceRefresh)
