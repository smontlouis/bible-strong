import { getDictionnaireDB } from '~helpers/database'

const SQLDTransaction = sqlReq => {
  return new Promise((resolve, reject) => {
    getDictionnaireDB().transaction(
      tx => {
        tx.executeSql(
          sqlReq,
          [],
          (_, { rows: { _array } }) => {
            resolve(_array)
          },
          (txObj, error) => reject(error)
        )
      },
      error => reject(error)
    )
  })
}

export default SQLDTransaction
