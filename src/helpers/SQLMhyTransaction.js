import { mhyDB } from '~helpers/database'

const SQLMhyTransaction = sqlReq => {
  return new Promise((resolve, reject) => {
    if (!mhyDB.get()) mhyDB.init()
    mhyDB.get().transaction(
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

export default SQLMhyTransaction
