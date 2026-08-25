import {
  Avatar,
  Button,
  Flex,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Portal,
} from '@chakra-ui/react'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'
import { BiBookOpen, BiCameraMovie } from 'react-icons/bi'
import {
  FaBackward,
  FaChevronDown,
  FaForward,
  FaPause,
  FaPlay,
} from 'react-icons/fa'
import { audioContent } from '../../helpers/audioContent'
import { Mode } from './useBibleAudioReader'

export interface BibleAudioFooterProps {
  isPlaying: boolean
  onPlay: () => void
  goToNext: () => void
  goToPrev: () => void
  canGoNext: boolean
  canGoPrev: boolean
  mode?: Mode
  changeMode?: Dispatch<SetStateAction<Mode>>
}

const getGroupTitle = (version: string) => {
  switch (version) {
    case 'esv': {
      return 'English'
    }
    case 'frc97': {
      return 'Français'
    }
    case 'cloned': {
      return 'Pastors'
    }
  }
}

const BibleAudioFooter = ({
  isPlaying,
  onPlay,
  goToNext,
  goToPrev,
  canGoNext,
  canGoPrev,
  mode,
  changeMode,
}: BibleAudioFooterProps) => {
  const router = useRouter()
  const { slug } = router.query
  const [version, person] = (slug as string[]) || []

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      mt={6}
      pos="sticky"
      bottom="4"
      background="blue.50"
      borderRadius="3xl"
      paddingY={{ base: '3', md: '6' }}
      paddingX={{ base: '2', md: '4' }}
      flexWrap="wrap"
    >
      {mode && (
        <Flex flex={1} justifyContent="center">
          <Menu placement="top" autoSelect={false}>
            <MenuButton
              as={Button}
              size="sm"
              colorScheme="blue"
              leftIcon={mode === 'read' ? <BiBookOpen /> : <BiCameraMovie />}
              rightIcon={<FaChevronDown />}
              variant="ghost"
            >
              {mode === 'read' ? 'Reading' : 'Immersive'}
            </MenuButton>
            <Portal>
              <MenuList maxH={400} minW={150}>
                <MenuItem
                  value="immersive"
                  onClick={() => changeMode?.('immersive')}
                  icon={<BiCameraMovie />}
                >
                  Immersive
                </MenuItem>
                <MenuItem
                  value="read"
                  onClick={() => changeMode?.('read')}
                  icon={<BiBookOpen />}
                >
                  Reading
                </MenuItem>
              </MenuList>
            </Portal>
          </Menu>
        </Flex>
      )}
      <HStack
        order={{ base: 2, md: 0 }}
        flexGrow={1}
        flexShrink={1}
        flexBasis={{ base: '100%', md: 'auto' }}
        alignItems="center"
        justifyContent="center"
        spacing="4"
      >
        <IconButton
          onClick={() => goToPrev()}
          colorScheme="blue"
          aria-label="Previous"
          icon={<FaBackward size={20} />}
          variant="ghost"
          isDisabled={!canGoPrev}
          isRound
        />
        <IconButton
          onClick={onPlay}
          colorScheme="blue"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          icon={isPlaying ? <FaPause size={24} /> : <FaPlay size={24} />}
          variant="ghost"
          isRound
        />
        <IconButton
          onClick={() => goToNext()}
          colorScheme="blue"
          aria-label="Next"
          icon={<FaForward size={20} />}
          variant="ghost"
          isDisabled={!canGoNext}
          isRound
        />
      </HStack>
      <Flex flex={1} justifyContent="center">
        <Menu placement="top" autoSelect={false}>
          <MenuButton
            as={Button}
            size="sm"
            colorScheme="blue"
            rightIcon={<FaChevronDown />}
            variant="ghost"
            leftIcon={
              <Avatar
                size="sm"
                src={`/images/people/${person}.${
                  version === 'cloned' ? 'jpg' : 'svg'
                }`}
                backgroundColor="gray.100"
              />
            }
          >
            {person}
          </MenuButton>
          <Portal>
            <MenuList minWidth="240px" maxH={400} overflow="auto">
              {audioContent.map((v) => (
                <MenuGroup
                  key={v.version}
                  defaultValue={v.version}
                  title={getGroupTitle(v.version)}
                  borderBottomWidth={1}
                  borderBottomColor="gray.100"
                  paddingY="2"
                  textTransform="uppercase"
                  color="gray.500"
                >
                  {v.people.map((p) => (
                    <MenuItem
                      key={p.name}
                      value={p.name}
                      icon={
                        <Avatar
                          size="md"
                          src={`/images/people/${p.name}.${
                            v.version === 'cloned' ? 'jpg' : 'svg'
                          }`}
                          backgroundColor="gray.100"
                        />
                      }
                      onClick={() =>
                        router.push(`/audio/${v.version}/${p.name}`)
                      }
                    >
                      {p.name}
                    </MenuItem>
                  ))}
                </MenuGroup>
              ))}
            </MenuList>
          </Portal>
        </Menu>
      </Flex>
    </Flex>
  )
}

export default BibleAudioFooter
