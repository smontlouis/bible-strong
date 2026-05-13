import Quill from './quill'
import type { QuillEmbedConstructor } from './quill-types'

const BlockEmbed = Quill.import('blots/block/embed') as QuillEmbedConstructor

class DividerBlock extends BlockEmbed {
  static blotName = 'divider'

  static tagName = 'hr'
}

Quill.register(DividerBlock)
