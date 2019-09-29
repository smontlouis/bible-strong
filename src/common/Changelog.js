import React from 'react'
import { ScrollView } from 'react-native'
import Modal from 'react-native-modalbox'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'
import { useSelector, useDispatch } from 'react-redux'

import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import changelog, { logTypes } from '~helpers/changelog'
import { saveAllLogsAsSeen } from '~redux/modules/user'

const StylizedModal = styled(Modal)(({ theme }) => ({
  height: 400,
  width: '80%',
  minWidth: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 10,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2
}))

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

const Tag = styled.View(({ type, theme }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: getTagColor(type),
  borderRadius: 3
}))

const hasNewLogs = (seenLogs, changelog) => {
  if (!seenLogs.length) {
    return true
  }

  const newLogs = findNewLogs(seenLogs, changelog)
  return !!newLogs.length
}

const findNewLogs = (seenLogs, changeLog) =>
  changeLog.filter(log => !seenLogs.find(c => c === log.date))

const Changelog = () => {
  const dispatch = useDispatch()
  const seenLogs = useSelector(state => Object.keys(state.user.bible.changelog))

  if (hasNewLogs(seenLogs, changelog)) {
    const newLogs = findNewLogs(seenLogs, changelog)
    return (
      <StylizedModal
        isOpen
        onClosed={() => {}}
        animationDuration={200}
        position="center"
        backdropOpacity={0.3}
        backdropPressToClose={false}
        swipeToClose={false}>
        <ScrollView flex={1}>
          <Box padding={20}>
            <Text fontSize={30} bold>
              Quoi de neuf ?
            </Text>
            <Text marginTop={5} fontSize={12} color="grey">
              Les changements depuis votre dernière visite
            </Text>
            <Border marginTop={15} />
            <Box marginTop={10}>
              {newLogs.map(log => (
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
        <Box padding={20} alignItems="flex-end">
          <Button title="Fermer" onPress={() => dispatch(saveAllLogsAsSeen(changelog))} small />
        </Box>
      </StylizedModal>
    )
  }

  return null
}

export default Changelog
