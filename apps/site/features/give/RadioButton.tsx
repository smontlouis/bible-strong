import type { InputHTMLAttributes } from 'react'

interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const RadioButton = (props: RadioCardProps) => {
  const { label, className = '', ...inputProps } = props

  return (
    <label className={`relative inline-flex h-10 cursor-pointer items-center justify-center border border-input px-4 py-2 text-sm font-medium first:rounded-l-md last:rounded-r-md has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground ${className}`}>
      {label}
      <input type="radio" className="sr-only" {...inputProps} />
    </label>
  )
}
