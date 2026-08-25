import { toast } from '~helpers/toast'

const captureError = (e: unknown, message: string): void => {
  toast.error(message)
  console.log(e)
}

export default captureError
