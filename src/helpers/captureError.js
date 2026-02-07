import { toast } from '~helpers/toast'

const captureError = (e, message) => {
  toast.error(message)
  console.log(e)
}

export default captureError
