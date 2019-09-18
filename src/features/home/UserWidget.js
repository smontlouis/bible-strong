import React from 'react'
import { useSelector } from 'react-redux'
import { ScrollView } from 'react-native'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'

const ProfileImage = styled.Image({
  width: 60,
  height: 60,
  borderRadius: 30,
  backgroundColor: 'rgba(0,0,0,0.1)'
  // borderWidth: 2,
  // borderColor: 'rgba(0, 0, 0, 0.1)'
})

const getPluriel = (word, count) => `${word}${count > 1 ? 's' : ''}`

const Chip = styled(Link)(({ theme }) => ({
  borderRadius: 10,
  backgroundColor: theme.colors.lightPrimary,
  paddingTop: 2,
  paddingBottom: 2,
  paddingLeft: 5,
  paddingRight: 5,
  marginRight: 10
}))

const UserWidget = ({ user }) => {
  const { highlights, notes, studies, tags } = useSelector(({ user: { bible } }) => ({
    highlights: Object.keys(bible.highlights).length,
    notes: Object.keys(bible.notes).length,
    studies: Object.keys(bible.studies).length,
    tags: Object.keys(bible.tags).length
  }))
  return (
    <>
      <Box flex>
        <Box>
          <ProfileImage source={{ uri: user.photoURL }} />
        </Box>
        <Box marginTop={10}>
          <Text bold fontSize={16}>
            {user.displayName}
          </Text>
        </Box>
      </Box>
      <ScrollView
        horizontal
        style={{ maxHeight: 55, paddingVertical: 10 }}
        contentContainerStyle={{
          flexDirection: 'row'
        }}>
        <Chip route="Highlights">
          <Text fontSize={12}>
            {highlights} {getPluriel('surbrillance', highlights)}
          </Text>
        </Chip>
        <Chip route="BibleVerseNotes">
          <Text fontSize={12}>
            {notes} {getPluriel('note', notes)}
          </Text>
        </Chip>
        <Chip route="Studies">
          <Text fontSize={12}>
            {studies} {getPluriel('étude', studies)}
          </Text>
        </Chip>
        <Chip route="Tags">
          <Text fontSize={12}>
            {tags} {getPluriel('étiquette', tags)}
          </Text>
        </Chip>
      </ScrollView>
    </>
  )
}

export default UserWidget
