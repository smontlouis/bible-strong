import { SQLiteDatabase } from 'expo-sqlite/legacy'
import {
  dictionnaireDB,
  interlineaireDB,
  mhyDB,
  naveDB,
  strongDB,
  tresorDB,
} from '~helpers/sqlite'

const getSQLTransaction = (
  getDB: () => SQLiteDatabase | undefined,
  initDB?: () => Promise<unknown>
) => (sqlReq: string, args = []) => {
  return new Promise(async (resolve, reject) => {
    if (!getDB() && initDB) {
      await initDB()
    }

    getDB()?.transaction(
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
          (txObj, error) => {
            reject(error)
            return false
          }
        )
      },
      error => {
        console.log('Error executing sql =>', error)
        reject(error.message)
      }
    )
  })
}

export const SQLStrongTransaction = getSQLTransaction(strongDB.get)
export const SQLDictionnaireTransaction = getSQLTransaction(dictionnaireDB.get)
export const SQLNaveTransaction = getSQLTransaction(naveDB.get)
export const SQLTresorTransaction = getSQLTransaction(tresorDB.get)
export const SQLMHYTransaction = getSQLTransaction(mhyDB.get, mhyDB.init)
export const SQLInterlineaireTransaction = getSQLTransaction(
  interlineaireDB.get,
  interlineaireDB.init
)
