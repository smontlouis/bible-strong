import { isMalformedDatabaseError, isReleasedHandleError } from '../sqliteErrors'

describe('SQLite error classification', () => {
  it.each([
    "Call to function 'NativeDatabase.execAsync' has been rejected.\n→ Caused by: database disk image is malformed",
    "Call to function 'NativeStatement.finalizeAsync' has been rejected.\n→ Caused by: Error code 11: database disk image is malformed",
    'file is not a database',
  ])('reads "%s" as a file SQLite cannot read', message => {
    expect(isMalformedDatabaseError(new Error(message))).toBe(true)
  })

  it.each([
    "Call to function 'NativeDatabase.prepareAsync' has been rejected.\n→ Caused by: The 2nd argument cannot be cast to type class expo.modules.sqlite.NativeStatement (received class java.lang.Integer)\n→ Caused by: Cannot convert provided JavaScriptObject to the SharedObject, because it doesn't contain valid id",
    'NativeDatabase already released',
  ])('reads "%s" as a released handle', message => {
    expect(isReleasedHandleError(new Error(message))).toBe(true)
  })

  it('reads the cause of a rejection too', () => {
    expect(
      isReleasedHandleError(
        new Error("Call to function 'NativeStatement.runAsync' has been rejected.", {
          cause: new Error('NativeStatement already released'),
        })
      )
    ).toBe(true)
  })

  it('leaves other SQLite errors alone', () => {
    const error = new Error(
      "Call to function 'NativeDatabase.prepareAsync' has been rejected.\n→ Caused by: no such table: verses"
    )

    expect(isMalformedDatabaseError(error)).toBe(false)
    expect(isReleasedHandleError(error)).toBe(false)
  })
})
