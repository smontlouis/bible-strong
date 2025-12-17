import SnackBarManager from './SnackBarManager'
const SnackBar = new SnackBarManager()

const getBackgroundColor = (type: any) => {
  switch (type) {
    case 'info':
      return '#2E302E'
    case 'danger':
      return 'rgb(194,40,57)'
    default:
      return '#2E302E'
  }
}
const Snackbar = {
  show(label: string, type = 'info', params = {}) {
    SnackBar.show(label, {
      backgroundColor: getBackgroundColor(type),
      buttonColor: 'white',
      textColor: 'white',
      tapToClose: true,
      duration: 3000,
      ...params,
    })
  },
}

export default Snackbar
