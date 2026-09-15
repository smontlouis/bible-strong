import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import CreateEntityRelationModal from '../CreateEntityRelationModal'
jest.mock('~helpers/verseToReference', () => ({
  __esModule: true,
  default: (keys: string[]) => keys.join(', '),
}))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))
jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({ bibleContent: { loadChapter: jest.fn() } }),
}))

const mockDispatch = jest.fn()
jest.mock('react-redux', () => ({ useDispatch: () => mockDispatch }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~features/search/SearchSelectionSheet', () => ({
  __esModule: true,
  default: 'shared-selector',
}))
jest.mock('~redux/modules/user', () => ({
  attachNoteToVerseAction: (payload: unknown) => ({ type: 'attach-note', payload }),
  createStudyRelation: (payload: unknown) => ({ type: 'relation', payload }),
}))
jest.mock('../domain', () => ({ endpointsMatch: () => false }))

it('keeps relation creation behind the relation adapter and excludes catalog sources', async () => {
  let tree!: ReactTestRenderer
  const created = jest.fn()
  await act(async () => {
    tree = create(
      <CreateEntityRelationModal
        sourceEndpoint={{ type: 'verse', verseKeys: ['1-1-1'] }}
        onCreated={created}
      />
    )
  })
  const selector = tree.root.findByType('shared-selector' as React.ElementType)
  expect(selector.props.allowedSources).toBeUndefined()
  await act(async () => {
    await selector.props.onSelectItem({
      id: 'note',
      type: 'notes',
      endpoint: { type: 'note', noteId: 'a' },
    })
  })
  expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'attach-note' }))
  expect(created).toHaveBeenCalledTimes(1)
  act(() => tree.unmount())
})

it('uses the insertion callback without creating a relation', async () => {
  mockDispatch.mockClear()
  const insert = jest.fn()
  let tree!: ReactTestRenderer
  await act(async () => {
    tree = create(
      <CreateEntityRelationModal
        sourceEndpoint={null}
        allowedTypes={['verse', 'note']}
        onSelectTarget={insert}
      />
    )
  })
  const selector = tree.root.findByType('shared-selector' as React.ElementType)
  expect(selector.props.allowedTypes).toEqual(['verse', 'note'])
  const target = { id: 'note', type: 'notes', endpoint: { type: 'note', noteId: 'a' } }
  await act(async () => {
    await selector.props.onSelectItem(target)
  })
  expect(insert).toHaveBeenCalledWith(target)
  expect(mockDispatch).not.toHaveBeenCalled()
  act(() => tree.unmount())
})
