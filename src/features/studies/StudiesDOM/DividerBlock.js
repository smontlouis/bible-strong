import Quill from './quill.js'

const BlockEmbed = Quill.import('blots/block/embed')

class DividerBlock extends BlockEmbed {
  static blotName = 'divider'

  static tagName = 'hr'
}

Quill.register(DividerBlock)
