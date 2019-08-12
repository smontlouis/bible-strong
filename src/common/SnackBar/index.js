import SnackBarManager from './SnackBarManager'
// import theme from '~themes/default'
const SnackBar = new SnackBarManager()

export default {
  show (label) {
    SnackBar.show(label, {
      backgroundColor: '#2E302E',
      buttonColor: 'blue',
      textColor: 'white',
      tapToClose: true,
      duration: 2500
    })
  }
}
