import type { Study } from '../modules/user'
import { createStudySyncIntent } from '../studySyncIntent'

describe('study sync intent', () => {
  const study = {
    id: 'study-1',
    title: 'Romains 8',
    content: { ops: [{ insert: 'Aucune condamnation\n' }] },
    user: { id: 'user-1', displayName: 'Paul', photoUrl: undefined },
  } as unknown as Study

  it('always writes the owner, which the rules check to create a missing study', () => {
    expect(
      createStudySyncIntent({
        studyId: 'study-1',
        changes: { title: 'Romains 8' },
        study,
        userId: 'user-1',
      })
    ).toEqual({
      kind: 'document-set',
      path: ['studies', 'study-1'],
      data: {
        title: 'Romains 8',
        content: { ops: [{ insert: 'Aucune condamnation\n' }] },
        user: { id: 'user-1', displayName: 'Paul' },
      },
      merge: true,
    })
  })

  it('writes the signed-in account as the owner of a study imported from another one', () => {
    const imported = { ...study, user: { id: 'other-account', displayName: 'Paul' } } as Study

    expect(
      createStudySyncIntent({ studyId: 'study-1', changes: {}, study: imported, userId: 'user-1' })
        .data.user
    ).toEqual({ id: 'user-1', displayName: 'Paul' })
  })
})
