const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])

export const isEnvironmentFlagEnabled = (value: string | undefined): boolean =>
  value !== undefined && TRUE_VALUES.has(value.trim().toLowerCase())
