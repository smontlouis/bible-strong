import { canonicalizeImportedDataForFirestore } from '../firestoreImportDataCanonicalization'

describe('Firestore import data canonicalization', () => {
  it('removes historical Bible identities before cloud writes without changing user text', () => {
    expect(
      canonicalizeImportedDataForFirestore({
        bible: {
          settings: {
            defaultBibleVersion: 'KJVS',
            defaultStrongBibleVersionId: 'LSGS',
            compare: { INT_EN: true },
          },
          notes: {
            note: { version: 'INT', description: 'KJVS and LSGS are user-authored text' },
          },
        },
        studies: {
          study: {
            title: 'Historical study',
            references: [{ type: 'verse', version: 'LSGS' }],
          },
        },
      })
    ).toEqual({
      bible: {
        settings: {
          defaultBibleVersion: 'KJV',
          defaultStrongBibleVersionId: 'LSG',
          compare: { BHG: true },
        },
        notes: {
          note: { version: 'BHG', description: 'KJVS and LSGS are user-authored text' },
        },
      },
      studies: {
        study: {
          title: 'Historical study',
          references: [{ type: 'verse', version: 'LSG' }],
        },
      },
    })
  })
})
