import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export const bookSelectorSelectionModeAtom = atomWithAsyncStorage<
  'grid' | 'list'
>('bookSelectorSelectionMode', 'list')

export const bookSelectorSortAtom = atomWithAsyncStorage<
  'alphabetical' | 'classical'
>('bookSelectorSort', 'classical')

export const bookSelectorVersesAtom = atomWithAsyncStorage<
  'with-verses' | 'without-verses'
>('bookSelectorVerses', 'without-verses')
