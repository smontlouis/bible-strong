interface QuillRange {
  index: number
  length: number
}

interface QuillBounds {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

interface DeltaStatic {
  ops: any[]
}

interface QuillHistory {
  undo(): void
  redo(): void
}

interface QuillSelection {
  getRange(): [QuillRange | null, ...any[]]
  savedRange: QuillRange | null
}

export interface QuillModule {
  format(name: string, value?: any): void
  receiveVerseLink(payload: any): void
  receiveStrongLink(payload: any): void
  receiveVerseBlock(payload: any): void
  receiveStrongBlock(payload: any): void
}

export interface QuillInstance {
  root: HTMLElement
  container: HTMLElement
  selection: QuillSelection
  history: QuillHistory
  clipboard: any

  on(eventName: string, handler: (...args: any[]) => void): void
  off(eventName: string, handler: (...args: any[]) => void): void
  focus(): void
  blur(): void
  enable(enabled?: boolean): void

  getContents(): DeltaStatic
  setContents(delta: any, source?: string): DeltaStatic
  getText(index?: number, length?: number): string
  getLength(): number

  getSelection(focus?: boolean): QuillRange | null
  setSelection(range: QuillRange | null, source?: string): void
  setSelection(index: number, source?: string): void
  setSelection(index: number, length: number, source?: string): void
  getBounds(range: QuillRange): QuillBounds

  getFormat(range?: QuillRange): Record<string, any>
  format(name: string, value: any, source?: string): void
  formatLine(index: number, length: number, formats: Record<string, any>, source?: string): void
  formatText(index: number, length: number, formats: Record<string, any>, source?: string): void

  insertText(index: number, text: string, source?: string): void
  insertText(index: number, text: string, format: string, value: any, source?: string): void
  insertEmbed(index: number, type: string, value: any, source?: string): void
  deleteText(index: number, length: number, source?: string): void

  getModule(name: string): QuillModule
  getLine(index: number): [any, number]
  getLeaf(index: number): [any, number]
}

interface QuillStatic {
  new (container: string | HTMLElement, options?: QuillOptions): QuillInstance
  events: {
    EDITOR_CHANGE: string
    SELECTION_CHANGE: string
    TEXT_CHANGE: string
  }
  sources: {
    API: string
    SILENT: string
    USER: string
  }
  import(path: string): any
  register(definitions: Record<string, any>, overwrite?: boolean): void
}

interface QuillOptions {
  theme?: string
  modules?: Record<string, any>
  placeholder?: string
  readOnly?: boolean
}

declare const Quill: QuillStatic
export default Quill
