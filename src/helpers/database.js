import SQLite from 'react-native-sqlite-storage'

const RNFS = require('react-native-fs')

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
        name: 'strong.sqlite',
        readOnly: true,
        createFromLocation: '/SQLite/strong.sqlite'
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
    this.dbStrong = undefined
  }
}

export const strongDB = new StrongDB()

export const initDictionnaireDB = () => {
  dbDictionnaire = SQLite.openDatabase(
    {
      name: 'dictionnaire.sqlite',
      createFromLocation: '/SQLite/dictionnaire.sqlite'
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
      name: 'interlineraire.sqlite',
      createFromLocation: '/SQLite/interlineaire.sqlite'
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
      name: 'commentaires-tresor.sqlite',
      createFromLocation: '/SQLite/commentaires-tresor.sqlite'
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
  dbDictionnaire = undefined
}

export const deleteTresorDB = () => {
  dbTresorCommentaires?._db?.close()
  dbTresorCommentaires = undefined
}

export const deleteInterlineaireDB = () => {
  dbInterlineaire?._db?.close()
  dbInterlineaire = undefined
}

class MhyDB {
  dbMhy

  init = () => {
    this.dbMhy = SQLite.openDatabase(
      {
        name: 'commentaires-mhy.sqlite',
        createFromLocation: '/SQLite/commentaires-mhy.sqlite'
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
    this.dbMhy = undefined
  }
}

export const mhyDB = new MhyDB()

class NaveDB {
  dbNave

  init = () => {
    this.dbNave = SQLite.openDatabase(
      {
        name: 'nave-fr.sqlite',
        createFromLocation: '/SQLite/nave-fr.sqlite'
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
    this.dbNave = undefined
  }
}

export const naveDB = new NaveDB()
