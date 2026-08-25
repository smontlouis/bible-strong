import { Heading, Stack } from '@chakra-ui/react'

export const DonationStep = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => {
  return (
    <Stack
      gap="4"
      sx={{
        counterIncrement: 'donation-steps',
      }}
    >
      <Heading
        as="h2"
        size="xs"
        color="gray.500"
        fontWeight="semibold"
        _before={{
          content: 'counter(donation-steps)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'blue.500',
          width: '1.2rem',
          height: '1.2rem',
          borderRadius: 'full',
          fontWeight: 'bold',
          marginRight: '0.5rem',
          fontSize: 'xs',
          bg: 'blue.100',
        }}
      >
        {label}
      </Heading>
      {children}
    </Stack>
  )
}
