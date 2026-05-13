import Quill from './quill'

const BlockEmbed: any = Quill.import('blots/block/embed')

class DividerBlock extends BlockEmbed {
  static blotName = 'divider'

  static tagName = 'hr'
}

Quill.register(DividerBlock)
