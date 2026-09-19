import { parseInlineBibleReferences } from '~helpers/bcvParser'
type Node = { type: string; value?: string; url?: string; children?: Node[] }
// Operate on Markdown text nodes only: leave existing links and code untouched.
export default function remarkBibleLinks() {
  return (tree: Node) => {
    const visit = (node: Node) => {
      if (!node.children || ['link', 'linkReference', 'code', 'inlineCode'].includes(node.type))
        return
      node.children = node.children.flatMap(child => {
        if (child.type !== 'text' || !child.value) {
          visit(child)
          return [child]
        }
        const refs = parseInlineBibleReferences(child.value)
        if (!refs.length) return [child]
        const pieces: Node[] = []
        let cursor = 0
        for (const ref of refs) {
          if (ref.start > cursor)
            pieces.push({ type: 'text', value: child.value.slice(cursor, ref.start) })
          pieces.push({
            type: 'link',
            url: `https://bible-strong.app/assistant-passage/${encodeURIComponent(ref.target.osis)}`,
            children: [{ type: 'text', value: ref.text }],
          })
          cursor = ref.end
        }
        if (cursor < child.value.length)
          pieces.push({ type: 'text', value: child.value.slice(cursor) })
        return pieces
      })
    }
    visit(tree)
  }
}
