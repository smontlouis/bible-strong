export async function boundedJSON(response: Response, limit = 96_000): Promise<any> {
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error(`Provider unavailable (${response.status})`)
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder()
  let text = '',
    length = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.length
      if (length > limit) throw new Error('Response too large')
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } finally {
    await reader.cancel().catch(() => {})
  }
}
