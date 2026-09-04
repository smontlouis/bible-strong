import { ElementType, parseDocument } from 'htmlparser2'
import { normalizeOsisReference } from './osisReference'

export type CanonicalBibleNoteMarkupNode =
  | {
      kind: 'text'
      text: string
    }
  | {
      kind: 'element'
      tag: 'note' | 'i' | 'divineName' | 'small-caps' | 'sup' | 'ref'
      attributes: Record<string, string>
      children: CanonicalBibleNoteMarkupNode[]
    }

export type CanonicalBibleNote = {
  offset: number
  order: number
  kind: 'note' | 'reference'
  markup: string
}

const SUPPORTED_TAGS = new Set(['note', 'i', 'divinename', 'small-caps', 'sup', 'ref'])

const CANONICAL_TAG_NAMES: Record<
  string,
  Extract<CanonicalBibleNoteMarkupNode, { kind: 'element' }>['tag']
> = {
  note: 'note',
  i: 'i',
  divinename: 'divineName',
  'small-caps': 'small-caps',
  sup: 'sup',
  ref: 'ref',
}

type NoteElementNode = Extract<CanonicalBibleNoteMarkupNode, { kind: 'element' }>
type ParsedNode = ReturnType<typeof parseDocument>['children'][number]
type ParsedElementNode = ParsedNode & {
  name: string
  attribs: Record<string, string>
  children: ParsedNode[]
}

export const parseCanonicalBibleNoteMarkup = (markup: string): CanonicalBibleNoteMarkupNode[] => {
  const nodes = parseNoteDocument(markup)
  const noteWrapper = nodes.find(
    (node): node is NoteElementNode => node.kind === 'element' && node.tag === 'note'
  )
  return noteWrapper?.children ?? nodes
}

export const getCanonicalBibleNoteLabel = (markup: string): string | undefined => {
  const noteWrapper = parseNoteDocument(markup).find(
    (node): node is NoteElementNode => node.kind === 'element' && node.tag === 'note'
  )
  return noteWrapper?.attributes.n || undefined
}

export const getCanonicalBibleNotePlainText = (nodes: CanonicalBibleNoteMarkupNode[]): string =>
  nodes
    .map(node => (node.kind === 'text' ? node.text : getCanonicalBibleNotePlainText(node.children)))
    .join('')

const parseNoteDocument = (markup: string): CanonicalBibleNoteMarkupNode[] => {
  const document = parseDocument(markup, {
    xmlMode: true,
    decodeEntities: true,
  })
  return document.children.flatMap(convertParsedNode)
}

const convertParsedNode = (node: ParsedNode): CanonicalBibleNoteMarkupNode[] => {
  if (node.type === ElementType.Text) {
    return node.data ? [{ kind: 'text', text: node.data }] : []
  }
  if (!isParsedElementNode(node)) return []

  const children = node.children.flatMap(convertParsedNode)
  const normalizedTag = node.name.toLocaleLowerCase()
  if (!SUPPORTED_TAGS.has(normalizedTag)) return children
  const attributes = { ...node.attribs }
  if (normalizedTag === 'ref' && attributes.id) {
    attributes.id = normalizeOsisReference(attributes.id)
  }

  return [
    {
      kind: 'element',
      tag: CANONICAL_TAG_NAMES[normalizedTag]!,
      attributes,
      children,
    },
  ]
}

const isParsedElementNode = (node: ParsedNode): node is ParsedElementNode => ElementType.isTag(node)
