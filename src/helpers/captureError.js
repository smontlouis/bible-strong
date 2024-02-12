import SnackBar from '~common/SnackBar'

const captureError = (e, message) => {
  SnackBar.show(message, 'danger')
  console.log(e)
}

export default captureError
