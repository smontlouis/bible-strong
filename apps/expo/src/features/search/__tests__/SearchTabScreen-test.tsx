import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { Provider } from 'jotai/react'
import { atom, createStore } from 'jotai/vanilla'
import type { SearchTab } from '~state/tabs'
import SearchTabScreen from '../SearchTabScreen'

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

const mockTranslate = (key: string) => key
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }))
jest.mock('~i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))
jest.mock('~common/ui/Container', () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => children,
}))
let mockInput: { searchValue: string; setSearchValue(value: string): void }
jest.mock('../SQLiteSearchScreen', () => ({
  __esModule: true,
  default: (props: typeof mockInput) => {
    mockInput = props
    return null
  },
}))

it('publishes the query and title together for each deletion, including clearing the input', () => {
  const initial = 'Dieu parle tantôt cependant'
  const target = 'Dieu parle tantôt'
  const searchAtom = atom<SearchTab>({
    id: 'search-test',
    title: initial,
    type: 'search',
    isRemovable: true,
    data: { searchValue: initial },
  })
  const store = createStore()
  const changes: SearchTab[] = []
  const unsubscribe = store.sub(searchAtom, () => changes.push(store.get(searchAtom)))
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(
        <Provider store={store}>
          <SearchTabScreen searchAtom={searchAtom} />
        </Provider>
      )
    })
    for (let length = initial.length - 1; length >= target.length; length--) {
      act(() => mockInput.setSearchValue(initial.slice(0, length)))
      expect(mockInput.searchValue).toBe(initial.slice(0, length))
    }
    expect(changes).toHaveLength(initial.length - target.length)
    expect(changes.every(tab => tab.title === tab.data.searchValue)).toBe(true)
    act(() => mockInput.setSearchValue(''))
    expect(changes).toHaveLength(initial.length - target.length + 1)
    expect(store.get(searchAtom)).toMatchObject({ title: 'Recherche', data: { searchValue: '' } })
  } finally {
    act(() => tree?.unmount())
    unsubscribe()
  }
})
