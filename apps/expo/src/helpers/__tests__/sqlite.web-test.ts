import { dbManager, openSQLiteDatabase } from '../sqlite.web'

describe('web SQLite boundary', () => {
  it('never opens or creates a local database', async () => {
    await expect(openSQLiteDatabase('bible.db')).rejects.toThrow('WEB_ONLINE_ONLY')
    await expect(dbManager.getDB('NAVE', 'fr').init()).rejects.toThrow('WEB_ONLINE_ONLY')
    expect(dbManager.getDB('NAVE', 'fr').get()).toBeUndefined()
  })
})
