import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import verseToStrong from '~helpers/verseToStrong'
import StrongVersePreview from '../StrongVersePreview'

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    ScrollView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement('ScrollView', props, children),
  }
})

jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest.requireActual<typeof import('react')>('react').createElement('Box', props, children),
}))

jest.mock('~common/ui/Paragraph', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    jest.requireActual<typeof import('react')>('react').createElement('paragraph', props, children),
}))

jest.mock('~features/bible/BibleStrongReference', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) =>
    jest.requireActual<typeof import('react')>('react').createElement('strong-reference', props),
}))

jest.mock('~helpers/memoize', () => ({
  __esModule: true,
  default: (fn: unknown) => fn,
}))

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  withScope: jest.fn(),
}))

const longVerseFixture =
  "Voici leur postérité 08435. Nebajoth 05032, premier-né 01060 d'Ismaël 03458, Kédar 06938, Adbeel 0110, Mibsam 04017,"

const createRenderer = (element: React.ReactElement) => {
  let renderer: ReactTestRenderer
  const consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
      return
    }
    console.warn(message, ...args)
  })

  try {
    act(() => {
      renderer = create(element)
    })
  } finally {
    consoleError.mockRestore()
  }

  return renderer!
}

describe('StrongVersePreview', () => {
  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('bounds long Strong content inside a flexible scroll viewport above the footer', async () => {
    const { formattedTexte, references } = await verseToStrong({
      Livre: 13,
      Texte: longVerseFixture,
    })
    const renderer = createRenderer(
      <StrongVersePreview height={300} footer={<FooterSentinel />}>
        {formattedTexte}
      </StrongVersePreview>
    )

    const preview = renderer.root.findByType('Box' as never)
    const scrollView = renderer.root.findByType('ScrollView' as never)
    const finalToken = renderer.root.findAllByType('strong-reference' as never).at(-1)!

    expect(preview.props.height).toBe(300)
    expect(preview.props.position).toBe('relative')
    expect(preview.props.zIndex).toBe(1)
    expect(preview.props.maxHeight).toBeUndefined()
    expect(scrollView.props.style).toEqual(expect.objectContaining({ flex: 1 }))
    expect(scrollView.props.nestedScrollEnabled).toBe(true)
    expect(preview.findAllByType('ScrollView' as never)).toHaveLength(1)
    expect(preview.findAllByType('footer-sentinel' as never)).toHaveLength(1)
    expect(scrollView.findAllByType('footer-sentinel' as never)).toHaveLength(0)
    expect(references.at(-1)).toBe('4017')
    expect(finalToken.props.reference).toBe('4017')
    expect(scrollView.findAllByType('strong-reference' as never).at(-1)?.props.reference).toBe(
      '4017'
    )
  })

  it('keeps short content natural inside the same viewport', () => {
    const renderer = createRenderer(
      <StrongVersePreview height={180} footer={<FooterSentinel />}>
        {React.createElement('paragraph', undefined, 'Au commencement')}
      </StrongVersePreview>
    )

    const scrollView = renderer.root.findByType('ScrollView' as never)

    expect(scrollView.props.contentContainerStyle).toEqual({ paddingTop: 10 })
    expect(renderer.root.findByType('paragraph' as never).children).toEqual(['Au commencement'])
  })
})

const FooterSentinel = () => React.createElement('footer-sentinel')
