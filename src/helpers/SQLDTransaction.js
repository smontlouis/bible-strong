import { getDictionnaireDB } from '~helpers/database'
import SnackBar from '~common/SnackBar'

const SQLDTransaction = sqlReq => {
  return new Promise((resolve, reject) => {
    try {
      getDictionnaireDB().transaction(
        tx => {
          tx.executeSql(
            sqlReq,
            [],
            (_, { rows: { _array } }) => {
              resolve(_array)
            },
            (txObj, error) => {
              SnackBar.show(
                "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
                'danger'
              )
              reject(error)
            }
          )
        },
        error => {
          SnackBar.show(
            "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
            'danger'
          )
          reject(error)
        }
      )
    } catch (e) {
      SnackBar.show(
        "Base de données corrompue. Veuillez contacter le développeur ou réinstaller l'application",
        'danger'
      )
    }
  })
}

export default SQLDTransaction
