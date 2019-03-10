import SnackBarManager from './SnackBarManager'
import theme from '../../themes/default'
const SnackBar = new SnackBarManager()

export default {
  show (label) {
    SnackBar.show(label, {
      backgroundColor: theme.colors.tertiary,
      buttonColor: 'blue',
      textColor: theme.colors.reverse,
      tapToClose: true,
      duraction: 2500
    })
  }
}
