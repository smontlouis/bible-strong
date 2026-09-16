export type AnalyticsEvent =
  | 'login'
  | 'sign_up'
  | 'note_created'
  | 'plan_started'
  | 'plan_reading_completed'
  | 'study_tab_view'
  | 'workspace_drawer_view'
export type AnalyticsParameters = Record<string, string | number>
export type AnalyticsTransport = {
  event: (name: string, parameters: AnalyticsParameters) => void | Promise<void>
  identify: (userId: string | null) => void | Promise<void>
}

// Serialize identity changes and events, including while the browser SDK loads.
// Tracking failures must never interrupt navigation or authentication.
export const createAnalyticsClient = (
  load: () => Promise<AnalyticsTransport | null>,
  enabled: () => boolean,
  reportError: () => void
) => {
  let pending = Promise.resolve()
  const enqueue = (operation: (transport: AnalyticsTransport) => void | Promise<void>) => {
    if (!enabled()) return Promise.resolve()
    pending = pending
      .then(async () => {
        const transport = await load()
        if (transport) await operation(transport)
      })
      .catch(reportError)
    return pending
  }
  return {
    event: (name: string, parameters: AnalyticsParameters = {}) =>
      enqueue(transport => transport.event(name, parameters)),
    identify: (userId: string | null) => enqueue(transport => transport.identify(userId)),
  }
}

// Route templates exclude account IDs, search strings and user-authored titles.
export const analyticsRoute = (segments: readonly string[]) => {
  const parts = segments.filter(segment => !segment.startsWith('('))
  return { path: `/${parts.join('/')}`, name: parts.at(-1) || 'index' }
}
