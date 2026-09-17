import { twMerge } from '~common/ui/classNames'
export const cn = (...values: (string | false | null | undefined)[]) =>
  twMerge(values.filter(Boolean).join(' '))
