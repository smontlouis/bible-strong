import SnackBarManager from './SnackBarManager'
// import theme from '~themes/default'
const SnackBar = new SnackBarManager()

const getBackgroundColor = type => {
  switch (type) {
    case 'info':
      return '#2E302E'
    case 'danger':
      return 'rgb(194,40,57)'
    default:
      return '#2E302E'
  }
}
export default {
  show(label, type = 'info', params = {}) {
    SnackBar.show(label, {
      backgroundColor: getBackgroundColor(type),
      buttonColor: 'blue',
      textColor: 'white',
      tapToClose: true,
      duration: 2500,
      ...params,
    })
  },
}
