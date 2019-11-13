import { naveDB } from '~helpers/database'

const SQLNTransaction = sqlReq => {
  return new Promise((resolve, reject) => {
    naveDB.get().transaction(
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

export default SQLNTransaction
