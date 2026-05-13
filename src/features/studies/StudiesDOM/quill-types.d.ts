export type QuillJSONValue =
  | boolean
  | number
  | string
  | null
  | QuillJSONValue[]
  | { [key: string]: QuillJSONValue | undefined }

export interface QuillRange {
  index: number
  length: number
}

export interface QuillBounds {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface DeltaStatic {
  ops: QuillJSONValue[]
  [key: string]: QuillJSONValue | undefined
}

export interface QuillHistory {
  undo(): void
  redo(): void
}

export interface QuillSelection {
  getRange(): [QuillRange | null, ...unknown[]]
  savedRange: QuillRange | null
}

export interface QuillModule {
  format(name: string, value?: unknown): void
  receiveVerseLink(payload: InlineVersePayload): void
  receiveStrongLink(payload: InlineStrongPayload): void
  receiveVerseBlock(payload: VerseBlockPayload): void
  receiveStrongBlock(payload: StrongBlockPayload): void
}

export interface InlineVersePayload {
  title: string
  verses: string[]
}

export interface InlineStrongPayload {
  title: string
  codeStrong: string
  book: string
}

export interface VerseBlockPayload {
  title: string
  verses: string[]
  content: string
  version: string
}

export interface StrongBlockPayload {
  title: string
  codeStrong: string
  book: string
  strongType?: string
  phonetique?: string
  definition?: string
  translatedBy?: string
  original?: string
}

export interface QuillInstance {
  root: HTMLElement
  container: HTMLElement
  selection: QuillSelection
  history: QuillHistory
  clipboard: unknown
  scroll: {
    descendant(blot: QuillBlotConstructor, index: number): [QuillBlot | null, number]
  }

  on(eventName: string, handler: (...args: unknown[]) => void): void
  off(eventName: string, handler: (...args: unknown[]) => void): void
  focus(): void
  blur(): void
  enable(enabled?: boolean): void

  getContents(): DeltaStatic
  setContents(delta: DeltaStatic, source?: string): DeltaStatic
  getText(index?: number, length?: number): string
  getLength(): number

  getSelection(focus?: boolean): QuillRange | null
  setSelection(range: QuillRange | null, source?: string): void
  setSelection(index: number, source?: string): void
  setSelection(index: number, length: number, source?: string): void
  getBounds(range: QuillRange): QuillBounds

  getFormat(range?: QuillRange | null): Record<string, unknown>
  format(name: string, value: unknown, source?: string): void
  formatLine(index: number, length: number, formats: Record<string, unknown>, source?: string): void
  formatText(index: number, length: number, formats: Record<string, unknown>, source?: string): void

  insertText(index: number, text: string, source?: string): void
  insertText(index: number, text: string, format: string, value: unknown, source?: string): void
  insertEmbed(index: number, type: string, value: unknown, source?: string): void
  deleteText(index: number, length: number, source?: string): void

  getModule(name: string): QuillModule
  getLine(index: number): [unknown, number]
  getLeaf(index: number): [unknown, number]
}

export interface QuillModuleConstructor {
  new (quill: QuillInstance, options?: unknown): QuillModule
}

export interface QuillTooltip {
  root: HTMLElement
  quill: QuillInstance
  show(): void
  hide(): void
  position(bounds: QuillBounds): void
}

export interface QuillTooltipConstructor {
  new (quill: QuillInstance, boundsContainer: HTMLElement): QuillTooltip
}

export interface QuillBlot {
  domNode: HTMLElement
  length(): number
}

export interface QuillBlotConstructor {
  new (): QuillBlot
  create(value?: unknown): HTMLElement
  formats(domNode: HTMLElement): Record<string, unknown>
}

export interface QuillEmbed {
  remove(): void
  update(mutations: MutationRecord[], context: unknown): void
}

export interface QuillEmbedConstructor {
  new (): QuillEmbed
  create(value?: unknown): HTMLElement
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
  import(path: string): unknown
  register(definitions: Record<string, unknown>, overwrite?: boolean): void
}

export interface QuillOptions {
  theme?: string
  modules?: Record<string, unknown>
  placeholder?: string
  readOnly?: boolean
}

export type { QuillStatic }
