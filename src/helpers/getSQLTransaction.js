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
  return new Promise((resolve, reject) => {
    if (!getDB() && initDB) initDB()
    getDB().transaction(
      tx => {
        tx.executeSql(
          sqlReq,
          args,
          (_, resultSet) => {
            const tmpResults = []
            for (let x = 0; x < resultSet.rows.length; x++) {
              tmpResults.push(resultSet.rows.item(x))
            }
            resolve(tmpResults)
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
