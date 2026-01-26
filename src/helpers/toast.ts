import { toast as sonnerToast } from 'sonner-native'

/**
 * Safe toast wrapper - silently fails if ToastContext not ready
 * This can happen during Redux rehydration before <Toaster /> is mounted
 *
 * Usage: Replace `import { toast } from 'sonner-native'`
 * with `import { toast } from '~helpers/toast'`
 */

const safeCall = <T extends (...args: any[]) => any>(fn: T, fallbackMsg?: string) => {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args)
    } catch {
      if (fallbackMsg) {
        console.warn('[Toast] Context not ready:', fallbackMsg, args[0])
      }
      return undefined
    }
  }
}

// Create callable function with methods
const toastFn = safeCall(sonnerToast, 'toast') as typeof sonnerToast

// Attach all methods
export const toast = Object.assign(toastFn, {
  error: safeCall(sonnerToast.error, 'error'),
  success: safeCall(sonnerToast.success, 'success'),
  info: safeCall(sonnerToast.info, 'info'),
  warning: safeCall(sonnerToast.warning, 'warning'),
  dismiss: safeCall(sonnerToast.dismiss),
  promise: safeCall(sonnerToast.promise, 'promise'),
})
