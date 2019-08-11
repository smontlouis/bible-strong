import SnackBarManager from './SnackBarManager'
import theme from '~themes/default'
const SnackBar = new SnackBarManager()

export default {
  show (label) {
    SnackBar.show(label, {
      backgroundColor: theme.colors.lightPrimary,
      buttonColor: 'blue',
      textColor: theme.colors.default,
      tapToClose: true,
      duration: 2500
    })
  }
}
