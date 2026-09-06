import { noteEditorStyles } from '../noteEditorStyles'

it('never resets the shared page height when a web note is mounted', () => {
  const css = noteEditorStyles(false)
  expect(css).not.toMatch(/html|body|height:\s*auto/)
  expect(css).toContain('.note-editor [contenteditable]')
})

it('preserves document sizing in a standalone native editor WebView', () => {
  expect(noteEditorStyles(true)).toContain('html, body')
  expect(noteEditorStyles(true)).toContain('height: auto')
})
