import { Flex } from '@chakra-ui/react'
import BasicAudioReader from './BasicAudioReader'
import BibleAudioReader from './BibleAudioReader'
import Header from './Header'

export interface AudioPageProps {
  version: string
  person: string
}

const AudioPage = ({ version, person }: AudioPageProps) => {
  return (
    <>
      <Flex
        margin="0 auto"
        maxW="650px"
        paddingX="5"
        paddingY={{ base: '4', md: '20' }}
        minH="100vh"
        flexDir="column"
      >
        <Header person={person} version={version} />
        {version === 'cloned' ? (
          <BasicAudioReader version={version} person={person} />
        ) : (
          <BibleAudioReader version={version} person={person} />
        )}
      </Flex>
      <style global jsx>
        {`
          html,
          body,
          #__next {
            min-height: 100vh;
          }
        `}
      </style>
    </>
  )
}

export default AudioPage
