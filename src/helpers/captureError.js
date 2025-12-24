import { toast } from 'sonner-native'

const captureError = (e, message) => {
  toast.error(message)
  console.log(e)
}

export default captureError
