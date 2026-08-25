import { Avatar, Box, Heading, Text, VStack } from '@chakra-ui/react'

export interface HeaderProps {
  person: string
  version: string
}

const Header = ({ person, version }: HeaderProps) => {
  const ext = version === 'cloned' ? 'jpg' : 'svg'
  return (
    <VStack mb="10" spacing="6">
      <Avatar
        size="xl"
        name={person}
        src={`/images/people/${person}.${ext}`}
        backgroundColor="blue.100"
      />
      <Box>
        <Heading size="2xl" textAlign="center">
          {version !== 'frc97' ? 'Genesis' : 'Genèse'}
        </Heading>
        <Heading size="md" textAlign="center">
          {version !== 'frc97' ? `narrated by ${person}` : `lue par ${person}`}
        </Heading>
      </Box>
      <Text fontSize="sm" textAlign="center" color="gray.600" maxW="300px">
        {version !== 'frc97'
          ? 'This is a proof of concept for a text to speech bible powered by AI.'
          : "Il s'agit d'une preuve de concept pour une bible vocale propulsée par Intelligence artificielle."}
      </Text>
    </VStack>
  )
}

export default Header
