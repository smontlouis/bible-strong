/** Document resets belong only to the dedicated native WebView, never the shared web page. */
export const noteEditorStyles = (standaloneDocument: boolean) => `
  @keyframes note-editor-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  ${standaloneDocument ? 'html, body { margin: 0; padding: 0; height: auto; overflow: hidden; }' : ''}
  .note-editor [contenteditable]:empty:before {
    content: attr(data-placeholder);
    color: var(--note-placeholder-color);
  }
  .note-editor [contenteditable]:focus { outline: none; }
`
