export type ResourceLoadSource = 'offline' | 'online'

type ResourceSourceLoggerOptions = {
  resource: string
  source: ResourceLoadSource
  enabled?: boolean
}

const TRACEABLE_OPERATION = /^(?:browse|find|list|load|random|search)/u

const truncate = (value: string) => (value.length > 40 ? `${value.slice(0, 37)}...` : value)

const describeArgument = (value: unknown): string | undefined => {
  if (typeof value === 'string') return truncate(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length} items]`
  if (!value || typeof value !== 'object') return undefined

  const record = value as Record<string, unknown>
  const selected = [
    'version',
    'versionId',
    'book',
    'chapter',
    'verse',
    'language',
    'locale',
    'code',
  ]
    .flatMap(key => {
      const item = describeArgument(record[key])
      return item === undefined ? [] : [`${key}=${item}`]
    })
    .slice(0, 4)

  return selected.length > 0 ? selected.join(' ') : undefined
}

const didLoadResource = (value: unknown) => {
  if (value === undefined || value === null) return false
  if (typeof value !== 'object' || Array.isArray(value)) return true

  const status = (value as { status?: unknown }).status
  return typeof status !== 'string' || status === 'available'
}

const logResourceSource = (
  options: ResourceSourceLoggerOptions,
  operation: string,
  args: unknown[]
) => {
  const details = args.map(describeArgument).filter(Boolean).join(' · ')
  console.log(
    `[ResourceSource] ${options.resource} · ${options.source.toUpperCase()} · ${operation}${details ? ` · ${details}` : ''}`
  )
}

export const withResourceSourceLogging = <Adapter extends object>(
  adapter: Adapter,
  options: ResourceSourceLoggerOptions
): Adapter => {
  const enabled = options.enabled ?? __DEV__
  if (!enabled) return adapter

  return new Proxy(adapter, {
    get(target, property, receiver) {
      const member = Reflect.get(target, property, receiver)
      if (
        typeof property !== 'string' ||
        typeof member !== 'function' ||
        !TRACEABLE_OPERATION.test(property)
      ) {
        return member
      }

      return (...args: unknown[]) => {
        const result = Reflect.apply(member, target, args)
        if (result instanceof Promise) {
          return result.then(value => {
            if (didLoadResource(value)) logResourceSource(options, property, args)
            return value
          })
        }

        if (didLoadResource(result)) logResourceSource(options, property, args)
        return result
      }
    },
  })
}
