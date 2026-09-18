/** Generated Markdown may contain links, but never auto-load remote images or HTML. */
export const prepareMarkdown = (text: string) => text.replace(/!\[/g, '[').replace(/</g, '&lt;')
export const safeLink = (url: string) => {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname === 'bible-strong.app' &&
      /^\/assistant-(source|passage)\//.test(parsed.pathname)
    )
      return undefined
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined
  } catch {
    return undefined
  }
}
