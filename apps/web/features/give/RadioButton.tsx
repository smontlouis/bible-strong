import { Button, useRadio, UseRadioProps } from '@chakra-ui/react'

export type TransformControlsMode = 'translate' | 'rotate' | 'scale'

interface RadioCardProps extends UseRadioProps {
  label: string
}

export const RadioButton = (props: RadioCardProps) => {
  const { getInputProps, getRadioProps } = useRadio(props)
  const { label } = props

  return (
    <Button
      as="label"
      {...getRadioProps()}
      _checked={{
        bg: 'blue.600',
        color: 'white',
        borderColor: 'blue.600',
      }}
    >
      {label}
      <input {...getInputProps()} />
    </Button>
  )
}
