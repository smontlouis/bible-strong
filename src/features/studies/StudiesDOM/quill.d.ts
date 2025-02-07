declare module 'quill' {
  export interface QuillOptions {
    theme?: string
    modules?: {
      toolbar?: any[]
    }
    placeholder?: string
    readOnly?: boolean
  }

  export interface DeltaStatic {
    ops: any[]
  }

  export default class Quill {
    constructor(container: HTMLElement, options?: QuillOptions)
    on(eventName: string, handler: Function): void
    getContents(): DeltaStatic
    setContents(delta: any[]): void
    enable(enabled: boolean): void
  }
}
