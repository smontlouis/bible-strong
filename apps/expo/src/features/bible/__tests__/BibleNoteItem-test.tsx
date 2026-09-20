import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { NoteListRow } from '~features/entityListQuery/noteListRows'
import BibleNoteItem from '../BibleNoteItem'

jest.mock('date-fns/formatDistance', () => () => '2 minutes')
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
jest.mock('~common/ui/classNames', () => ({ twMerge: (...values: string[]) => values.join(' ') }))
jest.mock('~common/EntityChipList', () => ({ __esModule: true, default: () => null }))
jest.mock('~common/Link', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Link', props, children),
  }
})
jest.mock('~common/ui/Border', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Border', props, children),
  }
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Box', props, children),
  }
})
jest.mock('~common/ui/Paragraph', () => ({ __esModule: true, default: 'Paragraph' }))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))
jest.mock('~features/notes/NoteOptionsPanel', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('NoteOptionsPanel', props, children),
  }
})
jest.mock('~helpers/languageUtils', () => ({ getDateLocale: () => undefined }))
jest.mock('~helpers/truncate', () => ({ __esModule: true, default: (text: string) => text }))
jest.mock('~helpers/useLanguage', () => ({ __esModule: true, default: () => 'fr' }))
jest.mock('~helpers/useMountTime', () => ({ __esModule: true, useMountTime: () => 0 }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {},
    fontFamily: { title: 'title' },
  }),
}))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: (font: string) => font }))

const createItem = (title: string, description: string): NoteListRow => ({
  id: 'note-1',
  noteId: 'note-1',
  reference: 'Matthieu 18:4',
  note: { title, description, date: 1 },
  title: title || description,
  description,
  date: 1,
})

describe('BibleNoteItem', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => {
    act(() => renderer?.unmount())
  })

  const renderItem = (item: NoteListRow) => {
    act(() => {
      renderer = create(<BibleNoteItem item={item} onPress={jest.fn()} onMenuPress={jest.fn()} />)
    })
  }

  it('keeps a title to two lines at the same size as its description', () => {
    renderItem(createItem('Un titre suffisamment long', 'Une description plus détaillée'))

    const title = renderer!.root.find(
      node => String(node.type) === 'Text' && node.props.children === 'Un titre suffisamment long'
    )
    const description = renderer!.root.find(node => String(node.type) === 'Paragraph')

    expect(title.props).toEqual(
      expect.objectContaining({
        className: 'text-[17px]',
        ellipsizeMode: 'tail',
        numberOfLines: 2,
      })
    )
    expect(description.props).toEqual(
      expect.objectContaining({
        children: 'Une description plus détaillée',
        scale: -1,
      })
    )
  })

  it('renders a note without a title as a description', () => {
    renderItem(createItem('', 'Une description sans titre'))

    expect(
      renderer!.root.findAll(
        node => String(node.type) === 'Text' && node.props.children === 'Une description sans titre'
      )
    ).toHaveLength(0)
    expect(renderer!.root.find(node => String(node.type) === 'Paragraph').props.children).toBe(
      'Une description sans titre'
    )
  })
})
