/** @jest-environment jsdom */

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'

// Exercise the DOM source without Expo's native WebView proxy transform.
const source = readFileSync(join(__dirname, '../HTMLContentDOM.tsx'), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const loaded = { exports: {} as typeof import('../HTMLContentDOM') }
new Function('require', 'module', 'exports', output)(
  (name: string) =>
    name === './readingHtml'
      ? require('../readingHtml')
      : name === '~assets/fonts/LiterataBook-Regular.otf'
        ? 'literata.woff'
        : require(name),
  loaded,
  loaded.exports
)
const HTMLContentDOM = loaded.exports.default

jest.mock('expo/dom', () => ({ IS_DOM: true }))
jest.mock('expo-font', () => ({ useFonts: () => [true] }))

it('reports rendered content height, including later growth and shrinkage', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let resize: () => void = () => undefined
  const disconnect = jest.fn()
  const originalObserver = globalThis.ResizeObserver
  Object.assign(globalThis, {
    ResizeObserver: class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  })
  let height = 560
  const offset = jest
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(() => height)
  const scroll = jest
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockImplementation(() => height)
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const onSizeChange = jest.fn(async (_height: number) => undefined)
  const props = {
    html: '<p>Aaron</p>',
    colors: { background: 'white', text: 'black', link: 'blue', emphasis: 'black' },
    onLinkClicked: async () => undefined,
    onSizeChange,
  }
  try {
    act(() => root.render(<HTMLContentDOM {...props} />))
    expect(container.textContent).toContain('Aaron')
    expect(onSizeChange).toHaveBeenLastCalledWith(560)
    height = 1240
    act(() => resize())
    expect(onSizeChange).toHaveBeenLastCalledWith(1240)
    height = 320
    act(() => root.render(<HTMLContentDOM {...props} html="<p>Entrée courte</p>" />))
    expect(onSizeChange).toHaveBeenLastCalledWith(320)
    act(() => root.unmount())
    expect(disconnect).toHaveBeenCalled()
  } finally {
    offset.mockRestore()
    scroll.mockRestore()
    globalThis.ResizeObserver = originalObserver
    container.remove()
  }
})
