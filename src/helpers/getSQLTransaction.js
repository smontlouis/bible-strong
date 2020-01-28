import {
  strongDB,
  getDictionnaireDB,
  mhyDB,
  naveDB,
  getTresorDB,
  getInterlineaireDB,
  initInterlineaireDB
} from '~helpers/database'

const getSQLTransaction = (getDB, initDB) => (sqlReq, args = []) => {
  console.log(sqlReq)
  return new Promise((resolve, reject) => {
    if (!getDB() && initDB) initDB()
    getDB().transaction(
      tx => {
        tx.executeSql(
          sqlReq,
          args,
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

export const SQLStrongTransaction = getSQLTransaction(strongDB.get)
export const SQLDictionnaireTransaction = getSQLTransaction(getDictionnaireDB)
export const SQLNaveTransaction = getSQLTransaction(naveDB.get)
export const SQLTresorTransaction = getSQLTransaction(getTresorDB)
export const SQLMHYTransaction = getSQLTransaction(mhyDB.get, mhyDB.init)
export const SQLInterlineaireTransaction = getSQLTransaction(
  getInterlineaireDB,
  initInterlineaireDB
)
