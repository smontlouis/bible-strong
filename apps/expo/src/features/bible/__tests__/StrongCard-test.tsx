import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { StrongLexiconEntry } from '~features/resources/strongLexiconAccess'
import StrongCard from '../StrongCard'

const mockPushRouteOnce = jest.fn()
const mockDismissTo = jest.fn()

jest.mock('@emotion/native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const createStyledComponent = (type: React.ElementType | string) => () =>
    function StyledComponent({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(type as React.ElementType, props, children)
    }
  const styled = Object.assign((type: React.ElementType) => createStyledComponent(type), {
    View: createStyledComponent('View'),
  })

  return { __esModule: true, default: styled }
})

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    ScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('ScrollView', props, children),
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ dismissTo: mockDismissTo }),
}))

jest.mock('jotai/react', () => ({ useAtomValue: () => false }))
jest.mock('jotai/vanilla', () => ({
  getDefaultStore: () => ({ get: jest.fn() }),
}))
jest.mock('~features/studies/atom', () => ({
  currentStudyIdAtom: {},
  openedFromTabAtom: {},
}))
jest.mock('~navigation/usePushRouteOnce', () => ({
  usePushRouteOnce: () => mockPushRouteOnce,
}))
jest.mock('~helpers/utils', () => ({
  cleanParams: () => ({}),
  wp: (value: number) => value,
}))

jest.mock('~common/StylizedHTMLView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('StylizedHTMLView', props)
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const makeHost = (name: string) =>
    function Host({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(name, props, children)
    }

  return {
    __esModule: true,
    default: makeHost('Box'),
    HStack: makeHost('HStack'),
    TouchableBox: makeHost('TouchableBox'),
    VStack: makeHost('VStack'),
  }
})
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Text', props, children)
})
jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) =>
      ReactModule.createElement('FeatherIcon', props),
  }
})
jest.mock('../ListenStrong', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('ListenStrong', props),
    hasStrongAudio: () => true,
  }
})

const entry = {
  id: 1,
  selectedIdentity: { kind: 'strong', code: 'H0430' },
  stepCode: 'H0430',
  classicStrong: 'H430',
  eStrong: 'H0430',
  dStrong: 'H0430',
  language: 'hebrew',
  baseCode: 430,
  original: 'אֱלֹהִים',
  transliteration: 'Elohim',
  pronunciation: 'el-o-heem',
  gloss: 'Dieu',
  morphology: { code: 'HNcmpa', meaning: 'nom commun masculin pluriel absolu' },
  relations: [],
  resources: [],
  lsjAbsent: false,
  modules: {
    resources: { moduleId: 'resources', status: 'missing' },
    entities: { moduleId: 'entities', status: 'missing' },
  },
} as StrongLexiconEntry

describe('StrongCard', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    mockPushRouteOnce.mockClear()
    mockDismissTo.mockClear()
    consoleError.mockRestore()
  })

  it('renders a fully clickable detail-style header with raw morphology', () => {
    act(() => {
      renderer = create(
        <StrongCard
          theme={{ colors: { default: '#000', quart: '#f00' }, fontFamily: {} } as never}
          book="1"
          strongEntry={entry}
          strongVerseContext={{
            book: 1,
            bibleChapter: 1,
            bibleVerse: 1,
            clickedWord: 'Dieu',
            morphologyCodes: [],
          }}
        />
      )
    })

    const header = renderer.root.find(node => String(node.type) === 'TouchableBox')
    const serialized = JSON.stringify(renderer.toJSON())
    expect(serialized).toContain('H0430')
    expect(serialized).toContain('אֱלֹהִים')
    expect(serialized).toContain('Dieu')
    expect(serialized).toContain('Elohim')
    expect(serialized).toContain('el-o-heem')
    expect(serialized).toContain('HNcmpa')
    expect(serialized).not.toContain('nom commun masculin pluriel absolu')

    act(() => header.props.onPress())
    expect(mockPushRouteOnce).toHaveBeenCalledTimes(1)
  })

  it('uses the contextual morphology and a smaller top-right audio control', () => {
    act(() => {
      renderer = create(
        <StrongCard
          theme={{ colors: { default: '#000', quart: '#f00' }, fontFamily: {} } as never}
          book="1"
          strongEntry={entry}
          strongVerseContext={{
            book: 1,
            bibleChapter: 1,
            bibleVerse: 1,
            clickedWord: 'les dieux',
            morphologyCodes: ['HVqp3ms'],
          }}
        />
      )
    })

    const serialized = JSON.stringify(renderer.toJSON())
    expect(serialized).toContain('HVqp3ms')
    expect(serialized).not.toContain('HNcmpa')
    expect(renderer.root.find(node => String(node.type) === 'ListenStrong').props).toEqual(
      expect.objectContaining({ iconSize: 13, touchSize: 32 })
    )
  })

  it('replaces audio with the selection action in selection mode', () => {
    act(() => {
      renderer = create(
        <StrongCard
          theme={{ colors: { default: '#000', quart: '#f00' }, fontFamily: {} } as never}
          book="1"
          strongEntry={entry}
          isSelectionMode="strong"
        />
      )
    })

    expect(renderer.root.findAll(node => String(node.type) === 'ListenStrong')).toHaveLength(0)
    expect(renderer.root.find(node => String(node.type) === 'FeatherIcon').props).toEqual(
      expect.objectContaining({ name: 'share', size: 17, color: 'primary' })
    )
  })

  it('inserts the STEP Strong code into a study', () => {
    act(() => {
      renderer = create(
        <StrongCard
          theme={{ colors: { default: '#000', quart: '#f00' }, fontFamily: {} } as never}
          book="1"
          strongEntry={{
            ...entry,
            selectedIdentity: { kind: 'dstrong', code: 'H3651C' },
            stepCode: 'H3651',
            classicStrong: 'H3651',
            eStrong: 'H3651',
            dStrong: 'H3651C =',
            baseCode: 3651,
          }}
          isSelectionMode="strong"
        />
      )
    })

    act(() => renderer.root.find(node => String(node.type) === 'TouchableBox').props.onPress())

    expect(mockDismissTo).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ codeStrong: 'H3651' }),
      })
    )
  })

  it('opens the STEP Strong identity instead of the source identity', () => {
    act(() => {
      renderer = create(
        <StrongCard
          theme={{ colors: { default: '#000', quart: '#f00' }, fontFamily: {} } as never}
          book="1"
          strongEntry={{
            ...entry,
            selectedIdentity: { kind: 'strong', code: 'H3651' },
            stepCode: 'H3651C',
          }}
        />
      )
    })

    act(() => renderer.root.find(node => String(node.type) === 'TouchableBox').props.onPress())

    expect(mockPushRouteOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          identityKind: 'dstrong',
          identityCode: 'H3651C',
        }),
      })
    )
  })
})
