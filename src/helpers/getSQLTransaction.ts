import { SQLiteDatabase } from 'expo-sqlite'
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

    try {
      const allRows = await getDB()?.getAllAsync(sqlReq, args)
      resolve(allRows)
    } catch (error) {
      console.log('Error executing sql =>', error)
      reject(error)
    }
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
