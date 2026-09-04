import type { DatabaseId, ResourceLanguage } from './databaseTypes'

export type SQLiteDatabase = {
  closeAsync: () => Promise<void>
  execAsync: (source: string) => Promise<void>
  getAllAsync: <Result>(source: string, ...params: unknown[]) => Promise<Result[]>
  getFirstAsync: <Result>(source: string, ...params: unknown[]) => Promise<Result | null>
}

const webOnlineOnlyError = () => new Error('WEB_ONLINE_ONLY')

export const openSQLiteDatabase = async (..._args: unknown[]): Promise<SQLiteDatabase> => {
  throw webOnlineOnlyError()
}

class WebDatabase {
  constructor(
    private readonly databaseId: DatabaseId | string,
    private readonly language: ResourceLanguage = 'fr'
  ) {}

  async init(): Promise<void> {
    throw webOnlineOnlyError()
  }

  get(): undefined {
    return undefined
  }

  async close(): Promise<void> {}

  async delete(): Promise<void> {}

  getPath(): string {
    return ''
  }

  getDbId(): DatabaseId | string {
    return this.databaseId
  }

  getLang(): ResourceLanguage {
    return this.language
  }
}

class WebDatabaseManager {
  getDB(databaseId: DatabaseId, language: ResourceLanguage): WebDatabase {
    return new WebDatabase(databaseId, language)
  }

  isInitialized(): boolean {
    return false
  }

  async closeLanguageDatabases(): Promise<void> {}

  async closeAll(): Promise<void> {}

  clearInstance(): void {}
}

export const dbManager = new WebDatabaseManager()

export const dictionnaireDB = new WebDatabase('DICTIONNAIRE')
export const mhyDB = new WebDatabase('MHY')
export const naveDB = new WebDatabase('NAVE')
export const tresorDB = new WebDatabase('TRESOR')

export const deleteAllDatabases = async (): Promise<void> => {}
export const sqliteDirPath = ''
export const initSQLiteDir = async (): Promise<void> => {}
export const initSQLiteDirForLang = async (): Promise<void> => {}
export const initSharedSQLiteDir = async (): Promise<void> => {}
export const checkDatabasesStorage = async (): Promise<void> => {}
export const checkForDatabase = async (): Promise<boolean> => false
export const checkDatabaseExistsForLang = async (): Promise<boolean> => false

export { WebDatabase as LanguageAwareDB }
