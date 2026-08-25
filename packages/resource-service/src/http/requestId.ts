export const resourceRequestIdFrom = (value: string | undefined): string =>
  value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : crypto.randomUUID()
