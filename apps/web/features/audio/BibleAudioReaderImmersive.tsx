import { Box, Text } from '@chakra-ui/react'

export interface BibleAudioReaderImmersiveProps {
  word: string
}

const BibleAudioReaderImmersive = ({
  word,
}: BibleAudioReaderImmersiveProps) => {
  return (
    <Box
      position="absolute"
      inset={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      sx={{
        '--color-red': 'color(display-p3 0.95 0.06 0.02)',
        '--color-orange': 'color(display-p3 0.97 0.61 0.07)',
        '--color-olive': 'color(display-p3 0.83 0.87 0.04)',
        '--color-lime': 'color(display-p3 0.31 0.89 0.05)',
        '--color-teal': 'color(display-p3 0.12 0.88 0.88)',
        '--color-tealer': 'color(display-p3 0.15 0.8 0.93)',
        '--color-blue': 'color(display-p3 0.14 0.47 0.99)',
        '--color-purple': 'color(display-p3 0.38 0.14 0.99)',
        '--color-purpler': 'color(display-p3 0.73 0.04 0.94)',
        '--color-pink': 'color(display-p3 0.93 0.03 0.85)',
      }}
    >
      <Text
        as="span"
        sx={{
          backgroundSize: '300px 300px',
          backgroundPosition: '0% 0%',
          fontSize: { base: '50px', md: '60px' },
          fontWeight: 'bold',

          backgroundClip: 'text',
          '-webkit-background-clip': 'text',
          backgroundImage:
            'conic-gradient(from 180deg, var(--color-red) 0%, var(--color-orange) 10%, var(--color-olive) 20%, var(--color-lime) 30%, var(--color-teal) 40%, var(--color-tealer) 50%, var(--color-blue) 60%, var(--color-purple) 70%, var(--color-purpler) 80%, var(--color-pink) 90%, var(--color-red) 100%)',

          animation: 'shine 10s linear infinite',
        }}
      >
        {word}
      </Text>
    </Box>
  )
}

export default BibleAudioReaderImmersive
