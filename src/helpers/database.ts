import SQLite from 'react-native-sqlite-storage'
import * as FileSystem from 'expo-file-system'
import { getDatabases } from './databases'

const RNFS = require('react-native-fs')

const databaseDictionnaireName = `dictionnaire-${Date.now()}`
const databaseStrongName = `strong-${Date.now()}`
const databaseInterlineaireName = `interlineaire-${Date.now()}`
const databaseTresorName = `tresor-${Date.now()}`
const databaseMhyName = `mhy-${Date.now()}`
const databaseNaveName = `naveFr-${Date.now()}`

export const getIfDatabaseExists = async sqliteFile => {
  const sqliteDirPath = `${RNFS.DocumentDirectoryPath}/SQLite`
  const dbPath = `${sqliteDirPath}/${sqliteFile}.sqlite`
  const dbFileExists = await RNFS.exists(dbPath)

  if (dbFileExists) {
    return true
  }

  return false
}

let dbDictionnaire
let dbInterlineaire
let dbTresorCommentaires

class StrongDB {
  dbStrong

  init = async () => {
    this.dbStrong = SQLite.openDatabase(
      {
        name: databaseStrongName,
        createFromLocation: '/SQLite/strong.sqlite',
      },
      () => {
        console.log('Strong loaded')
      },
      e => console.log(e)
    )

    return this.dbStrong
  }

  get = () => {
    return this.dbStrong
  }

  delete = () => {
    this.dbStrong?._db?.close()
    SQLite.deleteDatabase({ name: databaseStrongName, location: 'default' })
    this.dbStrong = undefined
  }
}

export const strongDB = new StrongDB()

export const initDictionnaireDB = () => {
  dbDictionnaire = SQLite.openDatabase(
    {
      name: databaseDictionnaireName,
      createFromLocation: '/SQLite/dictionnaire.sqlite',
    },
    () => {
      console.log('Dictionnaire loaded')
    },
    e => console.log(e)
  )

  return dbDictionnaire
}

export const initInterlineaireDB = () => {
  dbInterlineaire = SQLite.openDatabase(
    {
      name: databaseInterlineaireName,
      createFromLocation: '/SQLite/interlineaire.sqlite',
    },
    () => {
      console.log('Interlineaire loaded')
    },
    e => console.log(e)
  )
  return dbDictionnaire
}

export const initTresorDB = () => {
  dbTresorCommentaires = SQLite.openDatabase(
    {
      name: databaseTresorName,
      createFromLocation: '/SQLite/commentaires-tresor.sqlite',
    },
    () => {
      console.log('Tresor loaded')
    },
    e => console.log(e)
  )
  return dbTresorCommentaires
}

export const getDictionnaireDB = () => {
  return dbDictionnaire
}

export const getInterlineaireDB = () => {
  return dbInterlineaire
}

export const getTresorDB = () => {
  return dbTresorCommentaires
}

export const deleteDictionnaireDB = () => {
  dbDictionnaire?._db?.close()
  SQLite.deleteDatabase({ name: databaseDictionnaireName, location: 'default' })
  dbDictionnaire = undefined
}

export const deleteTresorDB = () => {
  dbTresorCommentaires?._db?.close()
  SQLite.deleteDatabase({
    name: databaseTresorName,
    location: 'default',
  })
  dbTresorCommentaires = undefined
}

export const deleteInterlineaireDB = () => {
  dbInterlineaire?._db?.close()
  SQLite.deleteDatabase({
    name: databaseInterlineaireName,
    location: 'default',
  })
  dbInterlineaire = undefined
}

class MhyDB {
  dbMhy

  init = () => {
    this.dbMhy = SQLite.openDatabase(
      {
        name: databaseMhyName,
        createFromLocation: '/SQLite/commentaires-mhy.sqlite',
      },
      () => {
        console.log('Commentaires loaded')
      },
      e => console.log(e)
    )
    return this.dbMhy
  }

  get = () => {
    return this.dbMhy
  }

  delete = () => {
    this.dbMhy?._db?.close()
    SQLite.deleteDatabase({
      name: databaseMhyName,
      location: 'default',
    })
    this.dbMhy = undefined
  }
}

export const mhyDB = new MhyDB()

class NaveDB {
  dbNave

  init = () => {
    this.dbNave = SQLite.openDatabase(
      {
        name: databaseNaveName,
        createFromLocation: '/SQLite/naveFr.sqlite',
      },
      () => {
        console.log('Nave loaded')
      },
      e => console.log(e)
    )
    return this.dbNave
  }

  get = () => {
    return this.dbNave
  }

  delete = () => {
    this.dbNave?._db?.close()
    SQLite.deleteDatabase({ name: databaseNaveName, location: 'default' })
    this.dbNave = undefined
  }
}

export const naveDB = new NaveDB()

export const deleteAllDatabases = async () => {
  // Reload app
  strongDB.delete()
  deleteDictionnaireDB()
  deleteTresorDB()
  mhyDB.delete()
  naveDB.delete()
  deleteInterlineaireDB()

  const intFile = await FileSystem.getInfoAsync(
    `${FileSystem.documentDirectory}SQLite/interlineaire.sqlite`
  )
  if (intFile.exists) FileSystem.deleteAsync(intFile.uri)

  await Promise.all(
    Object.values(getDatabases()).map(async db => {
      const file = await FileSystem.getInfoAsync(db.path)
      if (file.exists) await FileSystem.deleteAsync(file.uri)
    })
  )
}
