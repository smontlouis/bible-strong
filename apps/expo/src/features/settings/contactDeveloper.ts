export const SUPPORT_EMAIL = 'stephane@lestudio316.com'

export type SupportDiagnostics = Record<string, string | number | boolean | null | undefined>

export function buildSupportEmail(
  subject: string,
  template: string,
  diagnosticsTitle: string,
  diagnostics: SupportDiagnostics
) {
  const details = Object.entries(diagnostics)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  const body = `${template}\n\n--- ${diagnosticsTitle} ---\n${details}`
  return {
    subject,
    body,
    url: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    text: `${SUPPORT_EMAIL}\n${subject}\n\n${body}`,
  }
}
