import { Box, Flex, Text } from '@chakra-ui/react'
import { Annexe as AnnexeProps } from './helpers.study'

interface Props {
  annexe: AnnexeProps
}
const Annexe = ({ annexe }: Props) => {
  return (
    <Box>
      {annexe.map((item, idx) => {
        if (item.type === 'inline-strong') {
          const {
            // Type,
            // Grec,
            // Hebreu,
            // Origine,
            // Phonetique,
            // LSG,
            Mot,
            Definition,
            Code,
          } = item
          return (
            <Flex key={Code} mb={10}>
              <Box mr={3}>
                <Text color="primary">[{idx + 1}]</Text>
              </Box>
              <Box data-annexe={Code}>
                <Text data-title mb={1}>
                  {Mot}
                </Text>
                <div
                  data-content
                  dangerouslySetInnerHTML={{ __html: Definition }}
                ></div>
              </Box>
            </Flex>
          )
        }

        if (item.type === 'inline-verse') {
          const { title, verses, id } = item
          return (
            <Flex key={title} mb={10}>
              <Box mr={3}>
                <Text color="primary">[{idx + 1}]</Text>
              </Box>
              <Box data-annexe={id}>
                <Text data-title mb={1}>
                  {title}
                </Text>
                <Text data-content>
                  {verses.map((v) => (
                    <span key={v.id}>{v.content}</span>
                  ))}
                </Text>
              </Box>
            </Flex>
          )
        }
      })}
    </Box>
  )
}

export default Annexe
