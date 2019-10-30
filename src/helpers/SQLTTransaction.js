import { getTresorDB } from '~helpers/database'

const SQLTTransaction = sqlReq => {
  return new Promise((resolve, reject) => {
    getTresorDB().transaction(
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

export default SQLTTransaction
