import { getInterlineaireDB, initInterlineaireDB } from '~helpers/database'

const SQLITransaction = sqlReq => {
  return new Promise(async (resolve, reject) => {
    if (!getInterlineaireDB()) {
      await initInterlineaireDB()
    }
    getInterlineaireDB().transaction(
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

export default SQLITransaction
