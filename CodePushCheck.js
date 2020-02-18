import { Component } from 'react'
import codePush from 'react-native-code-push'
import SnackBar from '~common/SnackBar'

const codePushOptions = { checkFrequency: codePush.CheckFrequency.MANUAL }

@codePush(codePushOptions)
class CodePushCheck extends Component {
  componentDidMount() {
    codePush.sync(
      {
        updateDialog: false,
        installMode: codePush.InstallMode.ON_NEXT_RESTART
      },
      this.codePushStatusDidChange
    )
  }

  codePushStatusDidChange(status) {
    switch (status) {
      case codePush.SyncStatus.CHECKING_FOR_UPDATE:
        console.log('[CodePush] Checking for updates.')
        break
      case codePush.SyncStatus.DOWNLOADING_PACKAGE:
        console.log('[CodePush] Downloading package.')
        SnackBar.show('Une mise à jour est disponible, téléchargement...')
        break
      case codePush.SyncStatus.INSTALLING_UPDATE:
        console.log('[CodePush] Installing update.')
        break
      case codePush.SyncStatus.UP_TO_DATE:
        console.log('[CodePush] Up-to-date.')
        break
      case codePush.SyncStatus.UPDATE_INSTALLED:
        console.log('[CodePush] Update installed.')
        SnackBar.show("Mise à jour installée. Redémarrez l'app.")
        break
      default:
        break
    }
  }

  codePushDownloadDidProgress(progress) {
    console.log(`${progress.receivedBytes} of ${progress.totalBytes} received.`)
  }

  render() {
    return null
  }
}

export default CodePushCheck
