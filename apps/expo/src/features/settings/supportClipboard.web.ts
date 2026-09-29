export async function copySupportEmail(text: string) {
  await navigator.clipboard.writeText(text)
}
