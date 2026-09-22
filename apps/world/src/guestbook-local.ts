const SIGNED_KEY = 'bible-strong.world.guestbook.signed.v1'

/** One signature for this browser's local avatar, even after editing its appearance. */
export function readSignature(storage?: Pick<Storage, 'getItem'>): string | null {
  try {
    return (storage ?? localStorage).getItem(SIGNED_KEY) || null
  } catch {
    return null
  }
}

export function rememberSignature(id: string, storage?: Pick<Storage, 'setItem'>): void {
  try {
    ;(storage ?? localStorage).setItem(SIGNED_KEY, id)
  } catch {
    // The current dialog still remembers success if browser storage is unavailable.
  }
}
