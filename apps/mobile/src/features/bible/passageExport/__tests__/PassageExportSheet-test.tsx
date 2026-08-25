import React, { createRef } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { SheetRef } from '~common/sheet'
import PassageExportSheet from '../PassageExportSheet'
import { createPassageExport } from '../createPassageExport'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { toast } from '~helpers/toast'

const mockReduxState = {
  user: {
    id: null,
    sync: { isLoading: false, loaded: {} },
    bible: {
      notes: {},
      links: {},
      relations: {},
      wordAnnotations: {},
      studies: {},
      highlights: {},
      strongsGrec: {},
      strongsHebreu: {},
      naves: {},
      words: {},
    },
  },
}
const mockT = (key: string) => key

jest.mock('../createPassageExport', () => ({
  createPassageExport: jest.fn(),
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'cache://',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}))

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}))

jest.mock('@emotion/react', () => ({
  useTheme: () => ({ colors: { reverse: '#fff' } }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
}))

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector(mockReduxState),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}))

jest.mock('~helpers/bibleVersions', () => ({
  versions: { LSG: { name: 'Bible Segond 1910' } },
}))

jest.mock('~helpers/biblesDb', () => ({
  getMultipleVerses: jest.fn(async () => ({})),
}))

jest.mock('~features/resources/resourceAccess', () => ({
  ...(() => {
    const resources = {
      bibleContent: {
        loadVerseTexts: jest.fn(async () => ({})),
      },
    }
    return { useResourceAccess: () => resources }
  })(),
}))

jest.mock('~helpers/toast', () => ({
  toast: { error: jest.fn() },
}))

jest.mock('~common/sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Sheet = ReactModule.forwardRef(
    (
      {
        children,
        header,
        footer,
        onPresent,
        onDismiss,
      }: React.PropsWithChildren<{
        header?: React.ReactNode
        footer?: (props: Record<string, unknown>) => React.ReactNode
        onPresent?: () => void
        onDismiss?: () => void
      }>,
      ref: React.ForwardedRef<SheetRef>
    ) => {
      ReactModule.useImperativeHandle(ref, () => ({
        present: () => onPresent?.(),
        presentAt: () => onPresent?.(),
        resizeTo: jest.fn(),
        dismiss: () => onDismiss?.(),
        close: () => onDismiss?.(),
        forceClose: () => onDismiss?.(),
      }))
      return (
        <>
          {header}
          {children}
          {footer?.({})}
        </>
      )
    }
  )
  return {
    Sheet,
    SheetHeader: ({ title }: { title: string }) =>
      ReactModule.createElement('SheetHeader', { title }),
    SheetFooter: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SheetScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('SheetScrollView', props, children),
  }
})

jest.mock('~common/ChoiceFilterModal', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ReactModule.forwardRef((props: Record<string, unknown>, _ref) =>
    ReactModule.createElement('ChoiceFilterModal', props)
  )
})

jest.mock('~common/MultipleChoiceFilterModal', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ReactModule.forwardRef((props: Record<string, unknown>, _ref) =>
    ReactModule.createElement('MultipleChoiceFilterModal', props)
  )
})

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const Box = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)
  return {
    __esModule: true,
    default: Box,
    TouchableBox: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableBox', props, children),
  }
})

jest.mock('~common/ui/Button', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Button', props, children),
  }
})

jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) =>
      ReactModule.createElement('FeatherIcon', props),
  }
})

jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})

const exportResult = {
  text: 'Genèse 1 — Bible Segond 1910 (LSG)',
  reference: 'Genèse 1',
  verseKeys: ['1-1-1'],
  counts: { notes: 1, links: 0, relations: 0, tags: 0 },
  missingVerseTextKeys: [],
  hasSkippedInvalidData: false,
}

describe('PassageExportSheet', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    ;(createPassageExport as jest.Mock).mockResolvedValue(exportResult)
    ;(Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true)
    ;(Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined)
    ;(FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined)
    ;(FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined)
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    jest.useRealTimers()
    consoleError.mockRestore()
  })

  it('debounces preparation and provides selection, chapter, book and all content choices', async () => {
    const ref = createRef<SheetRef>()
    act(() => {
      renderer = create(
        <PassageExportSheet
          ref={ref}
          sourceType="selection"
          selectedVerses={{ '1-1-1': true }}
          version="LSG"
        />
      )
    })

    act(() => ref.current?.present())
    expect(createPassageExport).not.toHaveBeenCalled()
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })

    expect(createPassageExport).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'selection',
        selectedVerseKeys: ['1-1-1'],
        options: { bibleText: true, notes: true, links: true, relations: true, tags: true },
      })
    )
    const scopeModal = renderer.root.find(node => String(node.type) === 'ChoiceFilterModal')
    const contentModal = renderer.root.find(
      node => String(node.type) === 'MultipleChoiceFilterModal'
    )
    expect(scopeModal.props.options.map((item: { value: string }) => item.value)).toEqual([
      'selection',
      'chapter',
      'book',
    ])
    expect(contentModal.props.selectedValues).toEqual([
      'bibleText',
      'notes',
      'links',
      'relations',
      'tags',
    ])
  })

  it('shares the generated file and removes it from cache afterward', async () => {
    const ref = createRef<SheetRef>()
    act(() => {
      renderer = create(
        <PassageExportSheet
          ref={ref}
          sourceType="chapter"
          bookNumber={1}
          chapterNumber={1}
          version="LSG"
        />
      )
    })
    act(() => ref.current?.present())
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })

    const exportButton = renderer.root.find(
      node => String(node.type) === 'Button' && node.props.children === 'app.export'
    )
    expect(exportButton.props.disabled).toBe(false)
    await act(async () => exportButton.props.onPress())

    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'cache://genese-1.txt',
      expect.objectContaining({ mimeType: 'text/plain' })
    )
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('cache://genese-1.txt', {
      idempotent: true,
    })
  })

  it('recovers from a preparation error and reports it', async () => {
    ;(createPassageExport as jest.Mock).mockRejectedValue(new Error('Database unavailable'))
    const ref = createRef<SheetRef>()
    act(() => {
      renderer = create(
        <PassageExportSheet
          ref={ref}
          sourceType="chapter"
          bookNumber={1}
          chapterNumber={1}
          version="LSG"
        />
      )
    })
    act(() => ref.current?.present())
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })

    expect(toast.error).toHaveBeenCalledWith('passageExport.prepareError')
    const exportButton = renderer.root.find(
      node => String(node.type) === 'Button' && node.props.children === 'app.export'
    )
    expect(exportButton.props.disabled).toBe(true)
  })

  it('stops waiting after the preparation timeout', async () => {
    ;(createPassageExport as jest.Mock).mockReturnValue(new Promise(() => undefined))
    const ref = createRef<SheetRef>()
    act(() => {
      renderer = create(
        <PassageExportSheet
          ref={ref}
          sourceType="chapter"
          bookNumber={1}
          chapterNumber={1}
          version="LSG"
        />
      )
    })
    act(() => ref.current?.present())
    await act(async () => {
      await jest.advanceTimersByTimeAsync(15_150)
    })

    expect(toast.error).toHaveBeenCalledWith('passageExport.prepareTimeout')
    const contentModal = renderer.root.find(
      node => String(node.type) === 'MultipleChoiceFilterModal'
    )
    act(() => contentModal.props.onToggle('notes'))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })
    expect(createPassageExport).toHaveBeenCalledTimes(2)
  })

  it('serializes a new preparation behind one that is already running', async () => {
    let resolveFirst: (result: typeof exportResult) => void = () => undefined
    const firstGeneration = new Promise<typeof exportResult>(resolve => {
      resolveFirst = resolve
    })
    ;(createPassageExport as jest.Mock)
      .mockReturnValueOnce(firstGeneration)
      .mockResolvedValueOnce(exportResult)
    const ref = createRef<SheetRef>()
    act(() => {
      renderer = create(
        <PassageExportSheet
          ref={ref}
          sourceType="selection"
          selectedVerses={{ '1-1-1': true }}
          version="LSG"
        />
      )
    })
    act(() => ref.current?.present())
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })
    const contentModal = renderer.root.find(
      node => String(node.type) === 'MultipleChoiceFilterModal'
    )
    act(() => contentModal.props.onToggle('notes'))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })

    expect(createPassageExport).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveFirst(exportResult)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(createPassageExport).toHaveBeenCalledTimes(2)
  })

  it('does not create a cache file when sharing is unavailable', async () => {
    ;(Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false)
    const ref = createRef<SheetRef>()
    act(() => {
      renderer = create(
        <PassageExportSheet
          ref={ref}
          sourceType="chapter"
          bookNumber={1}
          chapterNumber={1}
          version="LSG"
        />
      )
    })
    act(() => ref.current?.present())
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150)
    })
    const exportButton = renderer.root.find(
      node => String(node.type) === 'Button' && node.props.children === 'app.export'
    )
    await act(async () => exportButton.props.onPress())

    expect(toast.error).toHaveBeenCalledWith('passageExport.sharingUnavailable')
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled()
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
  })
})
