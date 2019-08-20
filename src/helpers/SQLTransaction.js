import { getStrongDB } from '~helpers/database'
import SnackBar from '~common/SnackBar'

const SQLTransaction = sqlReq => {
  return new Promise((resolve, reject) => {
    try {
      getStrongDB().transaction(
        tx => {
          tx.executeSql(
            sqlReq,
            [],
            (_, { rows: { _array } }) => {
              resolve(_array)
            },
            (txObj, error) => {
              SnackBar.show(
                "Base de données corrompue. Veuillez contactez le développeur. Ou réinstallez l'application",
                'danger'
              )
              reject(error)
            }
          )
        },
        error => {
          SnackBar.show(
            "Base de données corrompue. Veuillez contactez le développeur. Ou réinstallez l'application",
            'danger'
          )
          reject(error)
        }
      )
    } catch (e) {
      SnackBar.show(
        "Base de données corrompue. Veuillez contactez le développeur. Ou réinstallez l'application",
        'danger'
      )
    }
  })
}

export default SQLTransaction
