import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'
import { useSelector } from 'react-redux'

import Container from '~common/ui/Container'
import ScrollView from '~common/ui/ScrollView'
import Header from '~common/Header'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { logTypes } from '~helpers/changelog'

const getTagColor = type => {
  switch (type) {
    case logTypes.BUG: {
      return '#e74c3c'
    }
    case logTypes.FEATURE: {
      return '#3498db'
    }
    case logTypes.NEW: {
      return '#2ecc71'
    }
    case logTypes.INFO: {
      return '#2c3e50'
    }
    default:
      return '#2c3e50'
  }
}

const Tag = styled.View(({ type }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: getTagColor(type),
  borderRadius: 3
}))

const Changelog = () => {
  const changelog = useSelector(state => state.user.changelog.data)

  return (
    <Container>
      <Header hasBackButton title="Changelog" />
      <ScrollView style={{ flex: 1 }}>
        <Box padding={20}>
          <Text fontSize={30} bold>
            Quoi de neuf ?
          </Text>
          <Text marginTop={5} fontSize={12} color="grey">
            Les changements depuis votre dernière visite
          </Text>
          <Border marginTop={15} />
          <Box marginTop={10}>
            {changelog.map(log => (
              <Box key={log.date} marginTop={10} marginBottom={10}>
                <Box row alignItems="flex-start">
                  <Text fontSize={16} bold flex>
                    {log.title}
                  </Text>
                  <Tag type={log.type}>
                    <Text fontSize={11} bold color="reverse">
                      {log.type}
                    </Text>
                  </Tag>
                </Box>
                <Text fontSize={10} color="grey">
                  Il y a{' '}
                  {distanceInWords(Number(log.date), Date.now(), {
                    locale: frLocale
                  })}
                </Text>
                <Text marginTop={10}>{log.description}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </ScrollView>
    </Container>
  )
}

export default Changelog
