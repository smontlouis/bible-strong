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
jest.mock('~helpers/useLanguage', () => ({ __esModule: true, default: () => 'fr' }))
jest.mock('~helpers/useMountTime', () => ({ __esModule: true, useMountTime: () => 0 }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {},
    fontFamily: { title: 'title' },
  }),
}))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: (font: string) => font }))

const createItem = (
  title: string,
  description: string,
  { isAnnotation = false }: { isAnnotation?: boolean } = {}
): NoteListRow => ({
  id: 'note-1',
  noteId: 'note-1',
  reference: isAnnotation ? 'Matthieu 18:4 (annotation)' : 'Matthieu 18:4',
  passage: 'Matthieu 18:4',
  isAnnotation,
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
      renderer = create(<BibleNoteItem item={item} onPress={jest.fn()} />)
    })
  }

  const findText = (children: unknown) =>
    renderer!.root.findAll(node => String(node.type) === 'Text' && node.props.children === children)

  it('caps the title at two lines and the description at three, at fixed sizes', () => {
    renderItem(createItem('Un titre suffisamment long', 'Une description plus détaillée'))

    const [title] = findText('Un titre suffisamment long')
    const [description] = findText('Une description plus détaillée')

    expect(title.props).toEqual(
      expect.objectContaining({
        className: expect.stringContaining('text-[16px]'),
        numberOfLines: 2,
      })
    )
    expect(description.props).toEqual(
      expect.objectContaining({
        className: expect.stringContaining('text-[14px]'),
        numberOfLines: 3,
      })
    )
  })

  it('renders a note without a title as its description alone', () => {
    renderItem(createItem('', 'Une description sans titre'))

    const matches = findText('Une description sans titre')
    expect(matches).toHaveLength(1)
    expect(matches[0].props.numberOfLines).toBe(3)
  })

  it('shows the passage and the date on one line, and marks an annotation with a badge', () => {
    renderItem(createItem('Titre', '', { isAnnotation: true }))

    expect(findText('Matthieu 18:4')).toHaveLength(1)
    expect(findText('Annotation')).toHaveLength(1)
    expect(findText('Matthieu 18:4 (annotation)')).toHaveLength(0)
  })
})
