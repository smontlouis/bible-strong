import React from 'react'
import verseToStrong from '../verseToStrong'

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  withScope: (callback: (scope: { setExtra: jest.Mock }) => void) =>
    callback({ setExtra: jest.fn() }),
}))

jest.mock('~common/ui/Paragraph', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

jest.mock('~features/bible/BibleStrongReference', () => ({
  __esModule: true,
  default: () => null,
}))

const MATTHEW_14_33 =
  '1161 Ceux qui étaient dans 1722 la barque 4143 vinrent 2064 (5631) se prosterner devant 4352 (5656) Jésus 846, et dirent 3004 (5723) : Tu es 1488 (5748) véritablement 230 le Fils 5207 de Dieu 2316. '

const collectLexicalProps = (nodes: React.ReactNode): { reference: string; word?: string }[] => {
  const lexicalProps: { reference: string; word?: string }[] = []

  React.Children.forEach(nodes, node => {
    if (
      !React.isValidElement<{ children?: React.ReactNode; reference?: string; word?: string }>(node)
    ) {
      return
    }

    if (node.props.reference) {
      lexicalProps.push({ reference: node.props.reference, word: node.props.word })
      return
    }

    collectLexicalProps(node.props.children).forEach(props => lexicalProps.push(props))
  })

  return lexicalProps
}

const collectTextChunks = (nodes: React.ReactNode): string[] => {
  const chunks: string[] = []

  React.Children.forEach(nodes, node => {
    if (!React.isValidElement<{ children?: React.ReactNode; reference?: string }>(node)) {
      return
    }

    if (node.props.reference) return

    if (typeof node.props.children === 'string') {
      chunks.push(node.props.children)
      return
    }

    collectTextChunks(node.props.children).forEach(chunk => chunks.push(chunk))
  })

  return chunks
}

describe('verseToStrong', () => {
  it('does not turn untranslated references into empty tokens and keeps multi-word surfaces intact', async () => {
    const { formattedTexte } = await verseToStrong(
      { Texte: MATTHEW_14_33, Livre: 40 },
      undefined,
      undefined,
      [{ Code: '4352', LSG: 'adorer, se prosterner devant ; 60' }]
    )
    const lexicalProps = collectLexicalProps(formattedTexte)

    expect(lexicalProps.find(({ reference }) => reference === '1161')).toEqual({
      reference: '1161',
      word: undefined,
    })
    expect(lexicalProps.find(({ reference }) => reference === '4352')).toEqual({
      reference: '4352',
      word: 'se prosterner devant',
    })
  })

  it('chunks long text runs without changing their whitespace', async () => {
    const visibleText =
      'Ce long segment doit pouvoir revenir à la ligne naturellement tout en conservant exactement  deux espaces,\nun saut de ligne et son espace final. '
    const { formattedTexte, model } = await verseToStrong({ Texte: visibleText, Livre: 40 })
    const textChunks = collectTextChunks(formattedTexte)

    expect(textChunks.length).toBeGreaterThan(1)
    expect(textChunks.join('')).toBe(visibleText)
    expect(model.visibleText).toBe(visibleText)
  })
})
