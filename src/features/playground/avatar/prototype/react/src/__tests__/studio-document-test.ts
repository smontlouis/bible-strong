import { createInitialSequences } from '../sequences'
import { initialExpressions } from '../presets'
import { createStudioDocumentStore, type StudioDocument } from '../studioDocument'

const documentFixture = (): StudioDocument => ({
  version: 2,
  library: {
    activeAvatarId: 'strobi',
    avatars: [],
  },
  expressions: initialExpressions,
  sequences: createInitialSequences(),
  playback: { stateId: 'idle', playing: true },
})

describe('Studio document', () => {
  it('persists one coherent document after a mutation', () => {
    const persisted: StudioDocument[] = []
    const store = createStudioDocumentStore(documentFixture(), value => persisted.push(value))

    store.update({ playback: { stateId: 'idle', playing: false } })

    expect(persisted).toHaveLength(1)
    expect(persisted[0].playback).toEqual({ stateId: 'idle', playing: false })
    expect(persisted[0].expressions).toHaveLength(initialExpressions.length)
  })

  it('repairs sequence references in the same transaction as expression deletion', () => {
    const store = createStudioDocumentStore(documentFixture(), () => undefined)
    const remainingExpressions = initialExpressions.slice(1)

    const next = store.update({ expressions: remainingExpressions })

    expect(
      next.sequences.every(sequence =>
        sequence.steps.every(step =>
          remainingExpressions.some(item => item.id === step.expressionId)
        )
      )
    ).toBe(true)
  })
})
