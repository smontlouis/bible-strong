// The analytics the Worker writes without the HTTP application. Nothing here may import
// Effect: the Worker loads this module when it starts, the product sink only with the
// application (`searchAnalyticsEngine.ts`).

export const valueOrNone = (value: string | undefined) => value ?? 'none'

export type SearchAnalyticsDataset = {
  writeDataPoint(event: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void
}

export const makeMetadataOnlyAiGatewayOptions = ({
  gatewayId,
  environment,
  contract,
  enabled,
}: {
  gatewayId: string
  environment: string
  contract: string
  enabled: boolean
}) => ({
  // Cloudflare keeps model/cost/duration metadata but never the embedding input or output.
  extraHeaders: { 'cf-aig-collect-log-payload': 'false' },
  gateway: {
    id: gatewayId,
    skipCache: true,
    collectLog: enabled,
    metadata: {
      environment,
      purpose: 'topic-query-embedding',
      contract,
    },
  },
})

export const writeSearchRuntimeEvent = (
  dataset: SearchAnalyticsDataset,
  {
    environment,
    event,
    route,
    status,
    cache,
    model,
    contract,
    errorClass,
    durationMs = 0,
    sqlStatements = 0,
    originRead = false,
    success = true,
  }: {
    environment: string
    event: 'request' | 'embedding'
    route: string
    status?: string
    cache?: string
    model?: string
    contract?: string
    errorClass?: string
    durationMs?: number
    sqlStatements?: number
    originRead?: boolean
    success?: boolean
  }
) => {
  dataset.writeDataPoint({
    indexes: [`${environment}:search-runtime:${event}`],
    blobs: [
      event,
      environment,
      route,
      valueOrNone(status),
      valueOrNone(cache),
      valueOrNone(model),
      valueOrNone(contract),
      valueOrNone(errorClass),
    ],
    doubles: [durationMs, sqlStatements, originRead ? 1 : 0, success ? 1 : 0],
  })
}
